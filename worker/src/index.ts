import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

type Env = {
  SALON_DB: D1Database;
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_LOCATION_ID: string;
  SQUARE_ENVIRONMENT?: 'production' | 'sandbox';
  SQUARE_BASE_URL?: string;
  SQUARE_VERSION?: string;
  BOOKING_TIME_ZONE?: string;
  BOOKING_EMBED_URL?: string;
};

type SquareCacheEntry<T> = {
  data: T | null;
  expires: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const squareCache: Record<string, SquareCacheEntry<unknown>> = {
  services: { data: null, expires: 0 },
  team: { data: null, expires: 0 }
};

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

const leadSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  source: z.string().trim().max(100).default('web')
});

const app = new Hono<{ Bindings: Env }>();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  })
);

app.get('/health', (c) => {
  const { env } = c;
  const squareConfigured = Boolean(env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID);
  console.log('health check squareConfigured', squareConfigured, {
    hasToken: !!env.SQUARE_ACCESS_TOKEN,
    hasLocation: !!env.SQUARE_LOCATION_ID,
    keys: Object.keys(env)
  });
  return c.json({
    status: 'ok',
    time: new Date().toISOString(),
    squareConfigured
  });
});

app.get('/api/config', (c) => {
  return c.json({
    timeZone: c.env.BOOKING_TIME_ZONE ?? 'America/New_York',
    embedUrl: c.env.BOOKING_EMBED_URL ?? '',
    squareLocationId: c.env.SQUARE_LOCATION_ID ?? ''
  });
});

app.get('/api/services', async (c) => {
  ensureSquareEnv(c.env);
  const services = await getCachedSquare('services', () => fetchSquareServices(c.env));
  return c.json({ source: 'square', services });
});

app.get('/api/team', async (c) => {
  ensureSquareEnv(c.env);
  const teamMembers = await getCachedSquare('team', () => fetchSquareTeamMembers(c.env));
  return c.json({ source: 'square', teamMembers });
});

app.get('/api/availability', async (c) => {
  ensureSquareEnv(c.env);
  const parsed = availabilitySchema.safeParse({
    serviceId: c.req.query('serviceId'),
    serviceVariationId: c.req.query('serviceVariationId'),
    date: c.req.query('date'),
    durationMinutes: c.req.query('durationMinutes'),
    teamMemberIds: c.req.queries()['teamMemberIds']
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const slots = await fetchSquareAvailability(c.env, parsed.data);
  return c.json({ source: 'square', slots });
});

app.post('/api/bookings', async (c) => {
  ensureSquareEnv(c.env);
  const body = await c.req.json();
  const parsed = squareBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const booking = await createSquareBooking(c.env, parsed.data);
  await persistBooking(c.env, booking);
  return c.json({ booking });
});

app.post('/api/leads', async (c) => {
  const body = await c.req.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  await persistLead(c.env, parsed.data);
  return c.json({ status: 'ok' });
});

app.onError((err, c) => {
  console.error('Worker error', err);
  if ('status' in err && err.status) {
    return c.json({ error: { message: err.message ?? 'Request failed' } }, err.status);
  }
  return c.json({ error: { message: err.message ?? 'Unexpected error' } }, 500);
});

app.notFound((c) => c.json({ error: { message: 'Not found' } }, 404));

export default app;

function ensureSquareEnv(env: Env) {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
    throw Object.assign(new Error('Square credentials missing'), { status: 500 });
  }
}

async function getCachedSquare<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = squareCache[key];
  const now = Date.now();
  if (entry && entry.data && entry.expires > now) {
    return entry.data as T;
  }
  const data = await fetcher();
  squareCache[key] = {
    data,
    expires: now + CACHE_TTL_MS
  };
  return data;
}

function resolveSquareBase(env: Env) {
  if (env.SQUARE_BASE_URL) return env.SQUARE_BASE_URL;
  const mode = env.SQUARE_ENVIRONMENT?.toLowerCase() ?? 'production';
  return mode === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

async function squareRequest<T>(
  env: Env,
  path: string,
  options: { method?: string; body?: unknown; searchParams?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(`${resolveSquareBase(env)}${path}`);
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }
  const response = await fetch(url.toString(), {
    method: options.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': env.SQUARE_VERSION ?? '2023-12-13',
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message =
      details?.errors?.[0]?.detail ??
      `Square request failed with status ${response.status}`;
    const error = Object.assign(new Error(message), {
      status: response.status,
      details
    });
    throw error;
  }
  return response.json<T>();
}

async function fetchSquareServices(env: Env) {
  const services: Array<{
    id: string;
    name: string;
    description: string;
    duration: number;
    price: number | null;
    category: string;
    teamMemberIds: string[];
    imageUrl: string | null;
    serviceVariationVersion?: number | null;
  }> = [];
  const categoryIds = new Set<string>();
  const imageIds = new Set<string>();
  let cursor: string | undefined;

  do {
    const searchParams: Record<string, string> = { types: 'ITEM' };
    if (cursor) searchParams.cursor = cursor;
    const result = await squareRequest<any>(env, '/v2/catalog/list', {
      method: 'GET',
      searchParams
    });
    const objects = result.objects ?? [];
    for (const obj of objects) {
      if (obj.is_deleted) continue;
      const item = obj?.item_data;
      if (!item || item.product_type !== 'APPOINTMENTS_SERVICE') continue;
      const baseName = item.name ?? 'Service';
      const description = item.description_plaintext ?? item.description ?? '';
      const itemImageIds: string[] = item.image_ids ?? [];
      itemImageIds.forEach((id: string) => imageIds.add(id));
      const itemCategoryIds: string[] = [];
      if (Array.isArray(item.categories)) {
        item.categories.forEach((cat: any) => {
          if (cat?.id) itemCategoryIds.push(cat.id);
        });
      } else if (item.category_id) {
        itemCategoryIds.push(item.category_id);
      }
      itemCategoryIds.forEach((id) => categoryIds.add(id));
      const variations = Array.isArray(item.variations) ? item.variations : [];
      for (const variation of variations) {
        if (variation.is_deleted) continue;
        const variationData = variation.item_variation_data;
        if (!variationData) continue;
        if (variationData.available_for_booking === false) continue;
        const durationMinutes = variationData.service_duration
          ? Math.round(variationData.service_duration / 60000)
          : null;
        const name =
          variationData.name && variationData.name !== 'Regular'
            ? `${baseName} - ${variationData.name}`
            : baseName;
        const priceMoney = variationData.price_money;
        const price = priceMoney ? priceMoney.amount / 100 : null;
        const teamMemberIds: string[] = Array.isArray(variationData.team_member_ids)
          ? variationData.team_member_ids.filter(Boolean)
          : [];
        const variationImageIds: string[] = Array.isArray(variationData.image_ids)
          ? variationData.image_ids.filter(Boolean)
          : [];
        variationImageIds.forEach((id) => imageIds.add(id));
        services.push({
          id: variation.id,
          name,
          description,
          duration: durationMinutes ?? 60,
          price,
          category: 'Salon Service',
          teamMemberIds,
          imageUrl: variationImageIds[0] ?? itemImageIds[0] ?? null,
          serviceVariationVersion: variation.version ?? null
        });
      }
    }
    cursor = result.cursor;
  } while (cursor);

  const categoryMap = categoryIds.size ? await fetchSquareCategories(env, Array.from(categoryIds)) : new Map();
  const imageMap = imageIds.size ? await fetchSquareImages(env, Array.from(imageIds)) : new Map();

  return services
    .map((service) => ({
      ...service,
      category: categoryMap.get(service.id) ?? service.category,
      imageUrl: service.imageUrl ? imageMap.get(service.imageUrl) ?? service.imageUrl : null
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchSquareCategories(env: Env, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const chunks = chunkArray(ids, 50);
  for (const chunk of chunks) {
    const result = await squareRequest<any>(env, '/v2/catalog/batch-retrieve', {
      body: { object_ids: chunk }
    });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.type === 'CATEGORY' && object.id) {
        map.set(object.id, object.category_data?.name ?? 'Salon Service');
      } else if (object.item_data?.variations) {
        for (const variation of object.item_data.variations) {
          const id = variation?.item_variation_data?.item_id;
          if (id) {
            const catName = object.item_data.category_id
              ? map.get(object.item_data.category_id)
              : object.item_data?.categories?.[0]?.name;
            if (catName) {
              map.set(id, catName);
            }
          }
        }
      }
    }
  }
  return map;
}

async function fetchSquareImages(env: Env, ids: string[]) {
  const map = new Map<string, string>();
  const chunks = chunkArray(ids, 50);
  for (const chunk of chunks) {
    const result = await squareRequest<any>(env, '/v2/catalog/batch-retrieve', {
      body: { object_ids: chunk }
    });
    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.type === 'IMAGE' && object.id && object.image_data?.url) {
        map.set(object.id, object.image_data.url);
      }
    }
  }
  return map;
}

async function fetchSquareTeamMembers(env: Env) {
  const team: any[] = [];
  let cursor: string | undefined;
  do {
    const result = await squareRequest<any>(env, '/v2/team-members/search', {
      body: { query: { filter: { status: 'ACTIVE' } } }
    });
    const members = result.team_members ?? [];
    team.push(...members);
    cursor = result.cursor;
  } while (cursor);

  return team
    .filter((member) => {
      const assignment = member.assigned_locations ?? {};
      if (assignment.assignment_type === 'ALL_CURRENT_AND_FUTURE_LOCATIONS') return true;
      const ids = assignment.location_ids ?? [];
      return ids.includes(env.SQUARE_LOCATION_ID);
    })
    .map((member) => {
      const nameParts = [member.given_name, member.family_name].filter(Boolean);
      const specialties = (member.wage_setting?.job_assignments ?? [])
        .map((job: any) => job.job_title)
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

async function fetchSquareAvailability(env: Env, params: z.infer<typeof availabilitySchema>) {
  const tz = env.BOOKING_TIME_ZONE ?? 'America/New_York';
  const start = new Date(`${params.date}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const segmentFilter: Record<string, unknown> = {
    service_variation_id: params.serviceVariationId
  };
  const teamMemberIds = Array.from(new Set(params.teamMemberIds.filter(Boolean)));
  if (teamMemberIds.length) {
    segmentFilter.team_member_id_filter = { any: teamMemberIds };
  }
  const body = {
    query: {
      filter: {
        location_id: env.SQUARE_LOCATION_ID,
        start_at_range: {
          start_at: start.toISOString(),
          end_at: end.toISOString()
        },
        segment_filters: [segmentFilter]
      },
      limit: 60
    }
  };
  const response = await squareRequest<any>(env, '/v2/bookings/availability/search', {
    body
  });
  const availabilities = response.availabilities ?? [];
  const slots = availabilities.map((availability: any) => {
    const dt = new Date(availability.start_at);
    return {
      id: availability.start_at,
      start: toTimeString(dt, tz),
      label: toLabelString(dt, tz),
      status: availability.status ?? 'open',
      teamMembers: availability.appointment_segments?.map((seg: any) => seg.team_member_id) ?? []
    };
  });
  return slots;
}

async function createSquareBooking(env: Env, payload: z.infer<typeof squareBookingSchema>) {
  const enforced = {
    ...payload,
    location_id: env.SQUARE_LOCATION_ID,
    idempotency_key: payload.idempotency_key ?? `booking_${cryptoRandomId()}`
  };
  const response = await squareRequest<any>(env, '/v2/bookings', {
    body: enforced
  });
  return response.booking;
}

async function persistBooking(env: Env, booking: any) {
  try {
    await env.SALON_DB.prepare(
      `INSERT OR IGNORE INTO bookings_local
      (id, square_booking_id, customer_name, customer_email, customer_phone, service_id, service_name, start_at, end_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      cryptoRandomId(),
      booking?.id ?? '',
      booking?.customer?.given_name ?? '',
      booking?.customer?.email_address ?? '',
      booking?.customer?.phone_number ?? '',
      booking?.appointment_segments?.[0]?.service_variation_id ?? '',
      booking?.appointment_segments?.[0]?.team_member_id ?? '',
      booking?.start_at ?? '',
      booking?.end_at ?? ''
    ).run();
  } catch (err) {
    console.error('Persist booking failed', err);
  }
}

async function persistLead(env: Env, lead: z.infer<typeof leadSchema>) {
  try {
    await env.SALON_DB.prepare(
      `INSERT INTO leads (id, name, email, phone, source)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(cryptoRandomId(), lead.name ?? '', lead.email ?? '', lead.phone ?? '', lead.source ?? 'web')
      .run();
  } catch (err) {
    console.error('Persist lead failed', err);
  }
}

function chunkArray<T>(input: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
}

function toTimeString(date: Date, _tz: string) {
  return date.toISOString().substring(11, 16);
}

function toLabelString(date: Date, _tz: string) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function cryptoRandomId() {
  return cryptoRandomBytes(12).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

function cryptoRandomBytes(length: number) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => ('0' + byte.toString(16)).slice(-2)).join('');
}
