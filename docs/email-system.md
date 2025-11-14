# Salon Glamour Messaging Platform

This document covers the higher-level design for the in-house messaging system requested for Salon Glamour NC. The goal is to own the entire communication stack (email + SMS) so transactional alerts, automations, and campaigns are consistent with the salon brand.

---

## Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| `Express API` | Adds `/api/messages/*` endpoints for transactional emails, campaigns, automations, and mass texting. | Lives beside the existing Square proxy so the frontend can call a single API host. |
| `EmailService` | Wraps SendGrid (can be swapped for AWS SES) and enforces brand styling, tracking tags, and default sender `no-reply@salonglamournc.com`. | Handles rate limiting, batching, and records each send inside `data/email-queue.json`. |
| `TemplateBuilder` | Generates branded HTML with logo, social icons, colors, CTA button, etc. | Allows quick creation of new templates without copying HTML. |
| `AutomationEngine` | Persists triggers + queued emails in `data/email-queue.json` and exposes functions to enqueue/schedule/deduplicate events. | Used by `/api/messages/automations` and by worker. |
| `Email Worker` (`src/workers/emailWorker.js`) | Small Node process intended to run on the VM via `pm2`/`systemd`. It polls the queue, sends due emails, and logs results for observability. | Keeps API responsive while heavy batches happen on the worker. |
| `SmsService` | Wraps Twilio Programmable Messaging for one-to-one alerts and broadcast texts. | Reuses salon contact segments (`data/contacts.json`). |

The API and worker share code through modules placed under `src/services/`.

---

## Provider choice: SendGrid

Either SendGrid or AWS SES can be used. SendGrid was chosen because:

1. Their template editor + UI is easier for stylists to manage when iterating on brand assets.
2. Deliverability tooling (link branding, subuser level stats) comes ready-made.
3. Switching to SES later only requires swapping the provider inside `EmailService`.

### Domain authentication

1. Create `no-reply@salonglamournc.com` in your email or DNS provider.
2. Inside SendGrid, add a dedicated sender domain for `salonglamournc.com`.
3. Publish the DKIM + Return-Path CNAMEs that SendGrid provides. (If Cloudflare proxies the root zone, set the records to **DNS only**.)
4. Optionally add a custom tracking domain such as `link.salonglamournc.com` for branded click tracking.

Once verified, update `.env` with:

```
SENDGRID_API_KEY=...
DEFAULT_FROM_EMAIL=no-reply@salonglamournc.com
```

---

## Automation + queue

- Automations (`first_visit`, `no_show_recovery`, `membership_renewal`, etc.) are stored in `data/email-queue.json`.
- `/api/messages/automations` allows the frontend or Square webhooks to enqueue events via a simple payload (type + contact info + merge fields).
- A background worker polls the queue. Messages marked as `scheduled` whose `sendAt` <= now are picked up, sent, and persisted as `sent` with response metadata or `failed` + error.
- The worker also backfills mass campaigns and ensures at-most-once delivery by checking `dedupeKey`.

### Running the worker

```
cd api
node src/workers/emailWorker.js           # foreground
# or with pm2
pm2 start src/workers/emailWorker.js --name salon-email-worker
```

Environment variables mirror the API process; copy the same `.env` so SendGrid + Twilio credentials are available.

---

## SMS + Mass texting

- `SmsService` integrates Twilio. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `SMS_FROM_NUMBER` in `.env`.
- Contacts + segments live in `data/contacts.json`—fields include `email`, `phone`, `tags`, and `marketingOptIn`.
- `/api/messages/sms/broadcast` validates opt-in, rate limits to batches of 200, and records each send in `data/sms-log.json` for audit trails.
- The worker is not required for SMS because Twilio already accepts batches asynchronously, but the module can be reused elsewhere if you want queue-based texting later.

---

## Frontend/API usage

1. **Transactional email** – POST `/api/messages/email/send` with `to`, `subject`, `body`, optional CTA + icons. The API immediately sends via SendGrid.
2. **Campaign/broadcast** – POST `/api/messages/email/campaigns` specifying `segment` filters (`tags`, `newClientsOnly`, etc.). The API slices contacts into batches and inserts them into the queue so the worker trickles them out.
3. **Automation** – POST `/api/messages/automations` describing the trigger (`type`, `sendAt`, `payload`). The worker handles the rest.
4. **Mass texting** – POST `/api/messages/sms/broadcast` with `message` + segment filters; Twilio takes care of dispatching within regulatory limits.

---

## Data files

| File | Description |
|------|-------------|
| `data/contacts.json` | Flat list of clients with contact info, tags, and opt-in preferences. Seeded with demo entries. |
| `data/email-queue.json` | The durable store for pending/processed emails, used by the API and worker. |
| `data/sms-log.json` | Append-only log for mass texting audits. |

These files keep the prototype self-contained. Once ready for production, point the services at your real CRM or database so automations use live data.

---

## Next steps

1. Populate `contacts.json` from Square or your CRM.
2. Create SendGrid dynamic templates for milestone campaigns, then store their IDs in `.env` or a simple JSON map.
3. Hook Square webhooks (`booking.created`, `booking.updated`) to call `/api/messages/automations` so clients automatically receive confirmations, reminders, and follow-ups.
4. For compliance, add unsubscribe links + STOP keywords that POST to the API to update `marketingOptIn`.
