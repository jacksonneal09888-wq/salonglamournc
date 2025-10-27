import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { google } from 'googleapis';
import { z } from 'zod';

dotenv.config();

const {
  PORT = 8788,
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_VERSION = '2023-12-13',
  BOOKING_TIME_ZONE = 'America/New_York',
  BOOKING_EMBED_URL = '',
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_CALENDAR_ID = 'primary'
} = process.env;

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const googleScopes = ['https://www.googleapis.com/auth/calendar'];
let calendarClient;

const availabilitySchema = z.object({
  serviceId: z.string().min(1),
  serviceVariationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().positive().default(60),
  teamMemberIds: z.array(z.string().min(1)).default([])
});

const squareBookingSchema = z
  .object({
    start_at: z.string(),
    end_at: z.string(),
    appointment_segments: z
      .array(
        z.object({
          duration_minutes: z.number().positive(),
          service_variation_id: z.string().min(1),
          team_member_id: z.string().min(1)
        })
      )
      .min(1),
    customer_details: z
      .object({
        given_name: z.string().optional(),
        email_address: z.string().optional(),
        phone_number: z.string().optional()
      })
      .optional()
  })
  .passthrough();

const googleEventSchema = z
  .object({
    summary: z.string().min(1),
    start: z.object({ dateTime: z.string().min(1), timeZone: z.string().optional() }),
    end: z.object({ dateTime: z.string().min(1), timeZone: z.string().optional() })
  })
  .passthrough();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    squareConfigured: Boolean(SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID),
    googleConfigured: Boolean(GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_SERVICE_ACCOUNT_KEY)
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    timeZone: BOOKING_TIME_ZONE,
    embedUrl: BOOKING_EMBED_URL,
    squareLocationId: SQUARE_LOCATION_ID ?? ''
  });
});

app.get('/api/availability', async (req, res, next) => {
  try {
    ensureSquareEnv();
    const rawTeamIds = req.query.teamMemberIds;
    const teamMemberIds = Array.isArray(rawTeamIds)
      ? rawTeamIds
      : rawTeamIds
      ? [rawTeamIds]
      : [];
    const params = availabilitySchema.parse({
      ...req.query,
      teamMemberIds
    });
    const slots = await fetchSquareAvailability(params);
    res.json({ source: 'square', slots });
  } catch (error) {
    next(error);
  }
});

app.post('/api/bookings', async (req, res, next) => {
  try {
    ensureSquareEnv();
    const payload = squareBookingSchema.parse(req.body);
    const booking = await createSquareBooking(payload);
    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

app.post('/api/google/calendar', async (req, res, next) => {
  try {
    ensureGoogleEnv();
    const payload = googleEventSchema.parse(req.body);
    const event = await insertGoogleEvent(payload);
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || err.response?.status || 500;
  res.status(status).json({
    error: {
      message: err.message ?? 'Unexpected server error',
      status,
      details: err.response?.data ?? undefined
    }
  });
});

app.listen(PORT, () => {
  console.log(`Booking proxy listening on port ${PORT}`);
});

function ensureSquareEnv() {
  if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
    throw new Error('Square environment variables are missing.');
  }
}

function ensureGoogleEnv() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google service account credentials are missing.');
  }
}

async function fetchSquareAvailability(params) {
  const tz = BOOKING_TIME_ZONE;
  const start = DateTime.fromISO(params.date, { zone: tz }).startOf('day');
  const end = start.plus({ days: 1 });
  const body = {
    query: {
      filter: {
        location_id: SQUARE_LOCATION_ID,
        start_at_range: {
          start_at: start.toUTC().toISO(),
          end_at: end.toUTC().toISO()
        },
        segment_filters: [
          {
            service_variation_id: params.serviceVariationId,
            team_member_id_filter: params.teamMemberIds.length ? { any: params.teamMemberIds } : undefined
          }
        ]
      },
      limit: 60
    }
  };
  const response = await squareFetch('/v2/availability/search', body);
  const availabilities = response.availabilities ?? [];
  const slotMap = new Map();
  for (const availability of availabilities) {
    const dt = DateTime.fromISO(availability.start_at).setZone(tz);
    const key = availability.start_at;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        id: key,
        start: dt.toFormat('HH:mm'),
        label: dt.toFormat('h:mm a'),
        status: 'open',
        teamMembers: availability.appointment_segments?.map(seg => seg.team_member_id) ?? []
      });
    } else {
      const existing = slotMap.get(key);
      existing.teamMembers.push(...(availability.appointment_segments?.map(seg => seg.team_member_id) ?? []));
    }
  }
  return Array.from(slotMap.values());
}

async function createSquareBooking(payload) {
  const enforced = {
    ...payload,
    location_id: SQUARE_LOCATION_ID,
    idempotency_key: payload.idempotency_key ?? `booking_${Date.now()}`
  };
  const response = await squareFetch('/v2/bookings', enforced);
  return response.booking;
}

async function insertGoogleEvent(payload) {
  const calendar = await getGoogleCalendar();
  const result = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody: payload
  });
  return result.data;
}

async function getGoogleCalendar() {
  if (calendarClient) return calendarClient;
  const key = GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT(GOOGLE_SERVICE_ACCOUNT_EMAIL, undefined, key, googleScopes);
  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

async function squareFetch(path, body) {
  const response = await fetch(`https://connect.squareup.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = new Error(`Square request failed with status ${response.status}`);
    error.status = response.status;
    error.response = {
      status: response.status,
      data: await response.json().catch(() => ({}))
    };
    throw error;
  }
  return response.json();
}
