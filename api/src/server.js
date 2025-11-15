import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { google } from 'googleapis';
import { z } from 'zod';
import nodeFetch from 'node-fetch';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAutomationTemplate } from './services/email/automationTemplates.js';
import { enqueueEmail, getQueueSnapshot } from './services/email/emailQueue.js';
import { sendBrandedEmail, ensureEmailProviderConfigured } from './services/email/emailService.js';
import { resolveSegment, buildMergeFields, upsertContact, findContactById } from './services/contacts.js';
import { sendSmsBroadcast, ensureSmsConfigured } from './services/sms/smsService.js';
import { applyMergeFields } from './utils/mergeFields.js';

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
  GOOGLE_CALENDAR_ID = 'primary',
  STYLIST_JWT_SECRET = 'change-me-in-production',
  STYLIST_SESSION_TTL_HOURS = '12'
} = process.env;

const squareEnvironment = typeof SQUARE_ENVIRONMENT === 'string' ? SQUARE_ENVIRONMENT.toLowerCase() : 'production';
const SQUARE_API_BASE_URL =
  SQUARE_BASE_URL ??
  (squareEnvironment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');
const httpFetch = globalThis.fetch ?? nodeFetch;
const SQUARE_CACHE_TTL_MS = 5 * 60 * 1000;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(moduleDir, '../data');
const STYLISTS_FILE = path.join(dataDir, 'stylists.json');
const NOTES_FILE = path.join(dataDir, 'notes.json');
const stylistSessionTtlMs = Math.max(Number.parseInt(STYLIST_SESSION_TTL_HOURS, 10) || 12, 1) * 60 * 60 * 1000;

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
let stylistCache = { data: null, mtime: 0 };
let notesCache = { data: null, mtime: 0 };

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
          service_variation_version: z.number().int().optional(),
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

const bodyContentSchema = z.union([z.string().min(1), z.array(z.string().min(1)).nonempty()]);
const ctaSchema = z.object({
  label: z.string().min(1),
  url: z.string().url()
});
const sendAtSchema = z.union([z.string(), z.number(), z.date()]).optional();

const emailSendSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).nonempty()]),
  subject: z.string().min(3),
  title: z.string().optional(),
  previewText: z.string().optional(),
  body: bodyContentSchema,
  cta: ctaSchema.optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
  sendAt: sendAtSchema,
  dedupeKey: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  highlight: z.string().optional()
});

const campaignSegmentSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    tagMatch: z.enum(['any', 'all']).optional(),
    marketingOptInOnly: z.boolean().optional(),
    newClientsOnly: z.boolean().optional()
  })
  .optional();

const campaignRequestSchema = z.object({
  subject: z.string().min(3),
  title: z.string().optional(),
  previewText: z.string().optional(),
  body: bodyContentSchema,
  cta: ctaSchema.optional(),
  highlight: z.string().optional(),
  sendAt: sendAtSchema,
  campaignName: z.string().default('campaign'),
  segment: campaignSegmentSchema,
  limit: z.number().int().positive().max(2000).default(500),
  mergeData: z.record(z.any()).optional()
});

const automationRequestSchema = z
  .object({
    type: z.string().min(1),
    contactId: z.string().optional(),
    contact: z
      .object({
        id: z.string().optional(),
        email: z.string().email(),
        name: z.string().optional(),
        phone: z.string().optional()
      })
      .optional(),
    subject: z.string().optional(),
    title: z.string().optional(),
    body: bodyContentSchema.optional(),
    previewText: z.string().optional(),
    cta: ctaSchema.optional(),
    sendAt: sendAtSchema,
    dedupeKey: z.string().optional(),
    mergeFields: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    template: z
      .object({
        subject: z.string().optional(),
        title: z.string().optional(),
        body: bodyContentSchema.optional(),
        cta: ctaSchema.optional()
      })
      .optional(),
    triggerId: z.string().optional()
  })
  .refine(data => data.contactId || data.contact, {
    message: 'contactId or contact is required'
  });

const smsBroadcastSchema = z.object({
  message: z.string().min(5).max(320),
  campaignName: z.string().default('sms-broadcast'),
  segment: campaignSegmentSchema,
  limit: z.number().int().positive().max(500).default(200)
});

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

app.post('/api/stylists/login', async (req, res, next) => {
  try {
    const { email, password, pin } = req.body ?? {};
    if (!email || !password || !pin) {
      return res.status(400).json({ error: { message: 'Email, password, and PIN are required.' } });
    }
    const stylist = await getStylistByEmail(email);
    if (!stylist) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }
    const [passwordOk, pinOk] = await Promise.all([
      bcrypt.compare(password, stylist.passwordHash),
      bcrypt.compare(pin, stylist.pinHash)
    ]);
    if (!passwordOk || !pinOk) {
      return res.status(401).json({ error: { message: 'Invalid credentials.' } });
    }
    const token = jwt.sign({ stylistId: stylist.id, role: stylist.role }, STYLIST_JWT_SECRET, {
      expiresIn: Math.floor(stylistSessionTtlMs / 1000)
    });
    res.json({
      token,
      profile: sanitizeStylist(stylist)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stylists/me', authenticateStylist, async (req, res) => {
  res.json({ profile: sanitizeStylist(req.stylist) });
});

app.get('/api/stylists/me/bookings', authenticateStylist, async (req, res, next) => {
  try {
    ensureSquareEnv();
    const stylist = req.stylist;
    const from = req.query.from ? DateTime.fromISO(req.query.from) : DateTime.utc().startOf('day');
    const to = req.query.to
      ? DateTime.fromISO(req.query.to)
      : from.plus({ days: Number.parseInt(req.query.days ?? '7', 10) || 7 });
    const teamMemberId =
      stylist.role === 'owner' && typeof req.query.teamMemberId === 'string'
        ? req.query.teamMemberId
        : stylist.squareStaffId;
    const body = {
      query: {
        filter: {
          location_ids: [SQUARE_LOCATION_ID],
          team_member_ids: teamMemberId ? [teamMemberId] : undefined,
          start_at_range: {
            start_at: from.toUTC().toISO(),
            end_at: to.toUTC().toISO()
          }
        },
        sort: {
          field: 'START_AT',
          order: 'ASC'
        },
        limit: 100
      }
    };
    const [response, services] = await Promise.all([
      squareFetch('/v2/bookings/search', body),
      getCachedSquare('services', fetchSquareServices).catch(() => [])
    ]);
    const serviceNameMap = new Map(
      (services ?? []).map(service => [service.squareCatalogObjectId, service.name])
    );
    const bookings = (response.bookings ?? []).map(booking => mapBookingForClient(booking, stylist, serviceNameMap));
    const notes = await loadNotes();
    res.json({
      bookings,
      notes: Object.fromEntries(
        Object.entries(notes.bookings ?? {}).map(([bookingId, entry]) => [
          bookingId,
          entry.filter(note => note.stylistId === stylist.id || stylist.role === 'owner')
        ])
      )
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stylists/me/bookings/:bookingId/notes', authenticateStylist, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { content } = req.body ?? {};
    if (!bookingId || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: { message: 'Note content is required.' } });
    }
    const notes = await loadNotes();
    const now = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID(),
      stylistId: req.stylist.id,
      stylistName: req.stylist.displayName ?? req.stylist.name,
      createdAt: now,
      content: content.trim()
    };
    if (!notes.bookings[bookingId]) notes.bookings[bookingId] = [];
    notes.bookings[bookingId].unshift(entry);
    await saveNotes(notes);
    res.status(201).json({ note: entry });
  } catch (error) {
    next(error);
  }
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
    handleBookingAutomation(payload, booking).catch(error => {
      console.error('Failed to queue booking automation', error);
    });
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

app.post('/api/messages/email/send', async (req, res, next) => {
  try {
    ensureEmailProviderConfigured();
    const payload = emailSendSchema.parse(req.body);
    const sendAtDate = parseSendAt(payload.sendAt);
    const shouldQueue = sendAtDate && sendAtDate.getTime() > Date.now() + 30000;
    const messageOptions = { ...payload };
    delete messageOptions.dedupeKey;
    const metadata = payload.metadata ?? {};
    if (shouldQueue) {
      const entry = await enqueueEmail({
        options: { ...messageOptions, sendAt: undefined },
        sendAt: sendAtDate.toISOString(),
        channel: 'manual',
        dedupeKey: payload.dedupeKey,
        metadata
      });
      return res.status(202).json({
        queued: true,
        entryId: entry.id,
        sendAt: entry.sendAt
      });
    }
    delete messageOptions.sendAt;
    const result = await sendBrandedEmail(messageOptions);
    res.json({
      queued: false,
      messageId: result.messageId
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages/email/campaigns', async (req, res, next) => {
  try {
    ensureEmailProviderConfigured();
    const payload = campaignRequestSchema.parse(req.body);
    const contacts = await resolveSegment(payload.segment ?? {}, { requireEmail: true });
    if (!contacts.length) {
      return res.status(404).json({ error: { message: 'No contacts matched the supplied segment.' } });
    }
    const sendAt = parseSendAt(payload.sendAt);
    const limit = payload.limit ?? 500;
    const queueIds = [];
    for (const contact of contacts.slice(0, limit)) {
      const mergeData = buildMergeFields(contact, payload.mergeData);
      const cta = payload.cta
        ? {
            label: applyMergeFields(payload.cta.label, mergeData),
            url: applyMergeFields(payload.cta.url, mergeData)
          }
        : undefined;
      const entry = await enqueueEmail({
        options: {
          to: contact.email,
          subject: applyMergeFields(payload.subject, mergeData),
          title: payload.title ? applyMergeFields(payload.title, mergeData) : undefined,
          previewText: payload.previewText ? applyMergeFields(payload.previewText, mergeData) : undefined,
          highlight: payload.highlight ? applyMergeFields(payload.highlight, mergeData) : undefined,
          body: applyMergeFields(payload.body, mergeData),
          cta,
          tags: ['campaign', payload.campaignName],
          metadata: {
            campaign: payload.campaignName,
            contactId: contact.id
          }
        },
        sendAt: sendAt?.toISOString(),
        channel: 'campaign',
        campaign: payload.campaignName,
        dedupeKey: `${payload.campaignName}:${contact.id}`,
        metadata: {
          campaign: payload.campaignName,
          contactId: contact.id
        }
      });
      queueIds.push(entry.id);
    }
    res.status(202).json({
      queued: true,
      count: queueIds.length,
      queueIds
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages/automations', async (req, res, next) => {
  try {
    ensureEmailProviderConfigured();
    const payload = automationRequestSchema.parse(req.body);
    const contact = await resolveAutomationContact(payload);
    if (!contact?.email) {
      return res.status(400).json({ error: { message: 'A contact with an email address is required.' } });
    }
    const template = {
      ...getAutomationTemplate(payload.type),
      ...(payload.template ?? {})
    };
    const mergeData = buildMergeFields(contact, payload.mergeFields);
    const subject = applyMergeFields(payload.subject ?? template.subject, mergeData);
    const title = applyMergeFields(payload.title ?? template.title ?? subject, mergeData);
    const body = applyMergeFields(payload.body ?? template.body, mergeData);
    const ctaTemplate = payload.cta ?? template.cta;
    const cta = ctaTemplate
      ? {
          label: applyMergeFields(ctaTemplate.label, mergeData),
          url: applyMergeFields(ctaTemplate.url, mergeData)
        }
      : undefined;
    const entry = await enqueueEmail({
      options: {
        to: contact.email,
        subject,
        title,
        body,
        previewText: payload.previewText ? applyMergeFields(payload.previewText, mergeData) : undefined,
        cta,
        tags: ['automation', payload.type],
        metadata: {
          automationType: payload.type,
          triggerId: payload.triggerId,
          contactId: contact.id ?? payload.contactId
        }
      },
      sendAt: (parseSendAt(payload.sendAt) ?? new Date()).toISOString(),
      channel: 'automation',
      dedupeKey: payload.dedupeKey ?? (contact.id ? `${payload.type}:${contact.id}` : undefined),
      metadata: {
        automationType: payload.type,
        triggerId: payload.triggerId,
        contactId: contact.id ?? payload.contactId
      }
    });
    res.status(202).json({
      queued: true,
      entryId: entry.id
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages/sms/broadcast', async (req, res, next) => {
  try {
    ensureSmsConfigured();
    const payload = smsBroadcastSchema.parse(req.body);
    const contacts = await resolveSegment(payload.segment ?? {}, { requirePhone: true });
    if (!contacts.length) {
      return res.status(404).json({ error: { message: 'No SMS opt-ins with phone numbers were found.' } });
    }
    const recipients = contacts.slice(0, payload.limit);
    const result = await sendSmsBroadcast({
      contacts: recipients,
      message: payload.message,
      campaign: payload.campaignName
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/messages/queue', async (req, res, next) => {
  try {
    const snapshot = await getQueueSnapshot();
    res.json(snapshot);
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
  const variationVersions = new Map();
  let cursor;

  do {
    const searchParams = new URLSearchParams({ types: 'ITEM,ITEM_VARIATION' });
    if (cursor) searchParams.set('cursor', cursor);
    const result = await squareRequest('/v2/catalog/list', { method: 'GET', searchParams });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.is_deleted) continue;
      if (object.type === 'ITEM_VARIATION') {
        variationVersions.set(object.id, object.version ?? null);
        continue;
      }
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
          serviceVariationVersion: variation.version ?? null,
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
        serviceVariationVersion:
          service.serviceVariationVersion ?? variationVersions.get(service.squareCatalogObjectId) ?? null,
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

async function loadStylists() {
  await fs.mkdir(path.dirname(STYLISTS_FILE), { recursive: true });
  try {
    const stats = await fs.stat(STYLISTS_FILE);
    if (stylistCache.data && stylistCache.mtime === stats.mtimeMs) {
      return stylistCache.data;
    }
    const raw = await fs.readFile(STYLISTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    stylistCache = { data: parsed, mtime: stats.mtimeMs };
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(STYLISTS_FILE, JSON.stringify([], null, 2));
      stylistCache = { data: [], mtime: 0 };
      return [];
    }
    throw error;
  }
}

async function getStylistByEmail(email) {
  const stylists = await loadStylists();
  return stylists.find(stylist => stylist.email?.toLowerCase() === email.toLowerCase());
}

async function getStylistById(id) {
  const stylists = await loadStylists();
  return stylists.find(stylist => stylist.id === id);
}

async function getStylistBySquareStaffId(squareStaffId) {
  if (!squareStaffId) return null;
  const stylists = await loadStylists();
  return stylists.find(stylist => stylist.squareStaffId === squareStaffId) ?? null;
}

function sanitizeStylist(stylist) {
  if (!stylist) return null;
  const capabilities =
    stylist.role === 'owner'
      ? ['bookings:view:all', 'bookings:manage:all', 'notes:manage', 'team:manage', 'transactions:view']
      : ['bookings:view:self', 'bookings:update:self', 'notes:manage'];
  return {
    id: stylist.id,
    name: stylist.name,
    displayName: stylist.displayName ?? stylist.name,
    email: stylist.email,
    phone: stylist.phone,
    role: stylist.role,
    squareStaffId: stylist.squareStaffId,
    capabilities
  };
}

function mapBookingForClient(booking, stylist, serviceNameMap = new Map()) {
  const customer = booking.customer ?? {};
  return {
    id: booking.id,
    status: booking.status,
    locationId: booking.location_id,
    startAt: booking.start_at,
    endAt: booking.end_at,
    customer: {
      id: booking.customer_id ?? null,
      givenName: customer.given_name ?? '',
      familyName: customer.family_name ?? '',
      emailAddress: customer.email_address ?? '',
      phoneNumber: customer.phone_number ?? ''
    },
    segments: (booking.appointment_segments ?? []).map(segment => ({
      id: segment.id,
      serviceVariationId: segment.service_variation_id,
      teamMemberId: segment.team_member_id,
      durationMinutes: segment.duration_minutes,
      serviceVariationVersion: segment.service_variation_version ?? null,
      serviceVariationName: serviceNameMap.get(segment.service_variation_id) ?? 'Service'
    })),
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    priceMoney: booking.total_price_money ?? null,
    stylistContext: {
      viewingStylistId: stylist.id,
      role: stylist.role
    }
  };
}

async function loadNotes() {
  try {
    const stats = await fs.stat(NOTES_FILE);
    if (notesCache.data && notesCache.mtime === stats.mtimeMs) {
      return notesCache.data;
    }
    const raw = await fs.readFile(NOTES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    notesCache = { data: parsed, mtime: stats.mtimeMs };
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initial = { bookings: {} };
      await saveNotes(initial);
      return initial;
    }
    throw error;
  }
}

async function saveNotes(notes) {
  await fs.mkdir(path.dirname(NOTES_FILE), { recursive: true });
  await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
  const stats = await fs.stat(NOTES_FILE);
  notesCache = { data: notes, mtime: stats.mtimeMs };
}

async function authenticateStylist(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Authorization required.' } });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: { message: 'Authorization required.' } });
    }
    const payload = jwt.verify(token, STYLIST_JWT_SECRET);
    const stylist = await getStylistById(payload.stylistId);
    if (!stylist) {
      return res.status(401).json({ error: { message: 'Invalid stylist session.' } });
    }
    req.stylist = stylist;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid or expired session.' } });
  }
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
      }
    }
  };
  console.log('Square availability request', JSON.stringify(body, null, 2));
  const response = await squareFetch('/v2/bookings/availability/search', body);
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
  const { customer_details: customerDetails, end_at: _endAt, ...rest } = payload;
  const enforcedBooking = {
    ...rest,
    location_id: SQUARE_LOCATION_ID
  };
  if (!enforcedBooking.start_at) {
    throw new Error('start_at is required to create a booking.');
  }
  const idempotencyKey = enforcedBooking.idempotency_key ?? `booking_${Date.now()}`;
  delete enforcedBooking.idempotency_key;

  if (customerDetails) {
    const customer = await createSquareCustomer(customerDetails).catch(error => {
      const details = error?.response?.data ?? error?.details ?? error;
      console.error('Failed to create Square customer', JSON.stringify(details, null, 2));
      return null;
    });
    if (customer?.id) {
      enforcedBooking.customer_id = customer.id;
    }
  }

  const response = await squareFetch('/v2/bookings', {
    idempotency_key: idempotencyKey,
    booking: enforcedBooking
  });
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

async function resolveAutomationContact(payload) {
  if (payload.contactId) {
    const contact = await findContactById(payload.contactId);
    if (contact?.email) {
      return contact;
    }
  }
  return payload.contact ?? null;
}

function parseSendAt(value) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  return new Date(timestamp);
}

async function handleBookingAutomation(originalPayload, booking) {
  try {
    ensureEmailProviderConfigured();
  } catch {
    return;
  }
  if (!booking) return;
  const customer = originalPayload.customer_details ?? {};
  const email = customer.email_address ?? '';
  if (!email) return;
  const nameParts = [customer.given_name, customer.family_name].filter(Boolean);
  const contact = await upsertContact({
    id: booking.customer_id ?? originalPayload.customer_id,
    name: nameParts.join(' ') || customer.given_name || '',
    email,
    phone: customer.phone_number ?? '',
    tags: ['square', 'client'],
    marketingOptIn: customer.marketing_opt_in ?? true
  });
  const start = booking.start_at ? DateTime.fromISO(booking.start_at).setZone(BOOKING_TIME_ZONE) : null;
  const firstSegment = booking.appointment_segments?.[0];
  const stylistName = await getStylistNameFromSegment(firstSegment);
  const mergeData = buildMergeFields(contact, {
    appointmentDate: start ? start.toFormat('cccc, LLL d') : '',
    appointmentTime: start ? start.toFormat('h:mm a') : '',
    stylist: stylistName ?? 'Your stylist',
    bookingLink: buildBookingLink(booking),
    serviceName: firstSegment?.service_variation_id ?? 'your service'
  });
  const template = getAutomationTemplate('booking_confirmation');
  await enqueueEmail({
    options: {
      to: contact.email,
      subject: applyMergeFields(template.subject, mergeData),
      title: applyMergeFields(template.title, mergeData),
      body: applyMergeFields(template.body, mergeData),
      cta: template.cta
        ? {
            label: applyMergeFields(template.cta.label, mergeData),
            url: applyMergeFields(template.cta.url, mergeData)
          }
        : undefined,
      tags: ['automation', 'booking_confirmation'],
      metadata: {
        automationType: 'booking_confirmation',
        bookingId: booking.id,
        contactId: contact.id
      }
    },
    sendAt: new Date().toISOString(),
    channel: 'automation',
    dedupeKey: `booking_confirmation:${booking.id}`,
    metadata: {
      automationType: 'booking_confirmation',
      bookingId: booking.id,
      contactId: contact.id
    }
  });
}

async function getStylistNameFromSegment(segment) {
  if (!segment?.team_member_id) return null;
  const stylist = await getStylistBySquareStaffId(segment.team_member_id);
  return stylist?.displayName ?? stylist?.name ?? null;
}

function buildBookingLink(booking) {
  const base = BOOKING_EMBED_URL || 'https://salonglamournc.com/booking';
  if (!booking?.id) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}bookingId=${encodeURIComponent(booking.id)}`;
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

async function createSquareCustomer(details = {}) {
  const givenName = (details.given_name ?? details.first_name ?? '').trim();
  const nameParts = givenName.split(/\s+/);
  const firstName = nameParts.shift() ?? '';
  const lastName = details.family_name ?? nameParts.join(' ');
  const email = details.email_address ?? details.email ?? '';
  const rawPhone = details.phone_number ?? details.phone ?? '';
  const phone = formatPhoneE164(rawPhone);
  if (!firstName && !email && !phone) {
    return null;
  }
  const body = {
    idempotency_key: details.idempotency_key ?? `customer_${Date.now()}`,
    given_name: firstName || undefined,
    family_name: lastName || undefined,
    email_address: email || undefined,
    phone_number: phone || undefined,
    reference_id: details.reference_id ?? undefined,
    note: details.note ?? undefined
  };
  const response = await squareRequest('/v2/customers', { method: 'POST', body });
  return response.customer ?? null;
}

function formatPhoneE164(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.startsWith('+')) {
    return digits;
  }
  return `+${digits}`;
}
