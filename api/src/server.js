import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { google } from 'googleapis';
import { z } from 'zod';
import nodeFetch from 'node-fetch';

dotenv.config();
if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoEnvPath = path.resolve(moduleDir, '../../.env');
  dotenv.config({ path: repoEnvPath });
}

const {
  PORT = 8788,
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_ENVIRONMENT = 'production',
  SQUARE_BASE_URL,
  SQUARE_VERSION = '2023-12-13',
  BOOKING_TIME_ZONE = 'America/New_York',
  BOOKING_EMBED_URL = '',
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_CALENDAR_ID = 'primary'
} = process.env;

const squareEnvironment = typeof SQUARE_ENVIRONMENT === 'string' ? SQUARE_ENVIRONMENT.toLowerCase() : 'production';
const SQUARE_API_BASE_URL =
  SQUARE_BASE_URL ??
  (squareEnvironment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');
const httpFetch = globalThis.fetch ?? nodeFetch;
const SQUARE_CACHE_TTL_MS = 5 * 60 * 1000;

const squareCache = {
  services: { data: null, expires: 0 },
  team: { data: null, expires: 0 }
};

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

app.get('/api/services', async (req, res, next) => {
  try {
    ensureSquareEnv();
    const services = await getCachedSquare('services', fetchSquareServices);
    res.json({ source: 'square', services });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team', async (req, res, next) => {
  try {
    ensureSquareEnv();
    const team = await getCachedSquare('team', fetchSquareTeamMembers);
    res.json({ source: 'square', teamMembers: team });
  } catch (error) {
    next(error);
  }
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

async function getCachedSquare(key, fetcher) {
  const entry = squareCache[key];
  const now = Date.now();
  if (entry?.data && entry.expires > now) {
    return entry.data;
  }
  const data = await fetcher();
  squareCache[key] = {
    data,
    expires: now + SQUARE_CACHE_TTL_MS
  };
  return data;
}

async function fetchSquareServices() {
  const services = [];
  const categoryIds = new Set();
  const imageIds = new Set();
  let cursor;

  do {
    const searchParams = new URLSearchParams({ types: 'ITEM' });
    if (cursor) searchParams.set('cursor', cursor);
    const result = await squareRequest('/v2/catalog/list', { method: 'GET', searchParams });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.is_deleted) continue;
      const item = object.item_data;
      if (!item || item.product_type !== 'APPOINTMENTS_SERVICE') continue;
      const baseName = item.name ?? 'Service';
      const baseDescription = item.description_plaintext ?? item.description ?? '';
      const itemImageIds = Array.isArray(item.image_ids) ? item.image_ids.filter(Boolean) : [];
      itemImageIds.forEach(id => imageIds.add(id));
      const itemCategoryIds =
        Array.isArray(item.categories) && item.categories.length
          ? item.categories.map(entry => entry.id).filter(Boolean)
          : item.category_id
          ? [item.category_id]
          : [];
      itemCategoryIds.forEach(id => categoryIds.add(id));
      const variations = Array.isArray(item.variations) ? item.variations : [];

      for (const variation of variations) {
        if (variation.is_deleted) continue;
        const variationData = variation.item_variation_data;
        if (!variationData) continue;
        if (variationData.available_for_booking === false) continue;
        const name =
          variationData.name && variationData.name !== 'Regular'
            ? `${baseName} - ${variationData.name}`
            : baseName;
        const priceMoney = variationData.price_money;
        const durationMinutes = variationData.service_duration
          ? Math.round(variationData.service_duration / 60000)
          : null;
        const variationImageIds = Array.isArray(variationData.image_ids)
          ? variationData.image_ids.filter(Boolean)
          : [];
        variationImageIds.forEach(id => imageIds.add(id));
        const teamMemberIds = Array.isArray(variationData.team_member_ids)
          ? variationData.team_member_ids.filter(Boolean)
          : [];

        services.push({
          id: variation.id,
          name,
          description: baseDescription,
          duration: durationMinutes ?? null,
          price: priceMoney ? priceMoney.amount / 100 : null,
          squareItemId: object.id,
          squareCatalogObjectId: variation.id,
          teamMemberIds,
          categoryIds: itemCategoryIds,
          imageIds: variationImageIds.length ? variationImageIds : itemImageIds
        });
      }
    }
    cursor = result.cursor;
  } while (cursor);

  const categoryMap = categoryIds.size ? await fetchSquareCategories(Array.from(categoryIds)) : new Map();
  const imageMap = imageIds.size ? await fetchSquareImages(Array.from(imageIds)) : new Map();

  return services
    .map(service => {
      const categoryName =
        service.categoryIds
          ?.map(id => categoryMap.get(id))
          .find(Boolean) ?? 'Salon Service';
      const imageUrl = service.imageIds?.map(id => imageMap.get(id)).find(Boolean) ?? null;
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration ?? 60,
        price: service.price,
        squareCatalogObjectId: service.squareCatalogObjectId,
        squareItemId: service.squareItemId,
        teamMemberIds: service.teamMemberIds,
        category: categoryName,
        imageUrl
      };
    })
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.name.localeCompare(b.name);
    });
}

async function fetchSquareTeamMembers() {
  const team = [];
  let cursor;

  do {
    const body = {
      query: {
        filter: {
          status: 'ACTIVE'
        }
      },
      limit: 100
    };
    if (cursor) body.cursor = cursor;
    const result = await squareRequest('/v2/team-members/search', { method: 'POST', body });
    const members = result.team_members ?? [];
    team.push(...members);
    cursor = result.cursor;
  } while (cursor);

  return team
    .filter(member => {
      const assignment = member.assigned_locations ?? {};
      if (assignment.assignment_type === 'ALL_CURRENT_AND_FUTURE_LOCATIONS') return true;
      const ids = assignment.location_ids ?? [];
      return ids.includes(SQUARE_LOCATION_ID);
    })
    .map(member => {
      const nameParts = [member.given_name, member.family_name].filter(Boolean);
      const specialties = (member.wage_setting?.job_assignments ?? [])
        .map(job => job.job_title)
        .filter(Boolean);
      return {
        id: member.id,
        name: nameParts.join(' ') || member.id,
        squareStaffId: member.id,
        email: member.email_address ?? '',
        phone: member.phone_number ?? '',
        specialties: specialties.length ? specialties.join(' / ') : 'Stylist',
        calendarEmail: member.email_address ?? ''
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchSquareCategories(categoryIds) {
  const map = new Map();
  const chunks = chunkArray(categoryIds, 40);
  for (const chunk of chunks) {
    const result = await squareRequest('/v2/catalog/batch-retrieve', {
      method: 'POST',
      body: { object_ids: chunk }
    });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.type !== 'CATEGORY') continue;
      const name = object.category_data?.name;
      if (name) {
        map.set(object.id, name);
      }
    }
  }
  return map;
}

async function fetchSquareImages(imageIds) {
  if (!imageIds.length) return new Map();
  const map = new Map();
  const chunks = chunkArray(imageIds, 40);
  for (const chunk of chunks) {
    const result = await squareRequest('/v2/catalog/batch-retrieve', {
      method: 'POST',
      body: { object_ids: chunk }
    });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.type !== 'IMAGE') continue;
      const url = object.image_data?.url;
      if (url) {
        map.set(object.id, url);
      }
    }
  }
  return map;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchSquareAvailability(params) {
  const tz = BOOKING_TIME_ZONE;
  const start = DateTime.fromISO(params.date, { zone: tz }).startOf('day');
  const end = start.plus({ days: 1 });
  const teamMemberIds = Array.from(new Set(params.teamMemberIds.filter(Boolean)));
  const segmentFilter = {
    service_variation_id: params.serviceVariationId
  };
  if (teamMemberIds.length) {
    segmentFilter.team_member_id_filter = { any: teamMemberIds };
  }
  const body = {
    query: {
      filter: {
        location_id: SQUARE_LOCATION_ID,
        start_at_range: {
          start_at: start.toUTC().toISO(),
          end_at: end.toUTC().toISO()
        },
        segment_filters: [segmentFilter]
      },
      limit: 60
    }
  };
  console.log('Square availability request', JSON.stringify(body, null, 2));
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
  return Array.from(slotMap.values()).map(slot => ({
    ...slot,
    teamMembers: Array.from(new Set(slot.teamMembers.filter(Boolean)))
  }));
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
  return squareRequest(path, { method: 'POST', body });
}

async function squareRequest(path, { method = 'POST', body, searchParams } = {}) {
  const url = new URL(`${SQUARE_API_BASE_URL}${path}`);
  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  } else if (searchParams && typeof searchParams === 'object') {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    }
  }

  const headers = {
    Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Square-Version': SQUARE_VERSION
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await httpFetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = new Error(`Square request failed with status ${response.status}`);
    error.status = response.status;
    let details;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      details = await response.json().catch(() => undefined);
    } else {
      details = await response.text().catch(() => undefined);
    }
    error.response = {
      status: response.status,
      data: details
    };
    if (details) {
      error.details = details;
    }
    throw error;
  }
  return response.json();
}
