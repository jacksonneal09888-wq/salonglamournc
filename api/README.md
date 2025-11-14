# Salon Glamour API proxy

This folder holds a lightweight Express server that keeps Square + Google credentials off the public site while powering the custom booking UI.

## Environment variables

Copy `.env.example` (below) into the repo root `.env` or export the variables before running Docker:

```
SQUARE_ACCESS_TOKEN=replace-with-live-token
SQUARE_LOCATION_ID=RP38RJ3DZ5D4R
SQUARE_VERSION=2023-12-13
SQUARE_ENVIRONMENT=sandbox
SQUARE_BASE_URL=https://connect.squareupsandbox.com
BOOKING_TIME_ZONE=America/New_York
BOOKING_EMBED_URL=https://salonglamournc.com/booking

STYLIST_JWT_SECRET=replace-with-long-random-string
STYLIST_SESSION_TTL_HOURS=12

GOOGLE_SERVICE_ACCOUNT_EMAIL=booking-proxy@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=primary

# Messaging + branding
SENDGRID_API_KEY=replace-with-sendgrid-key
DEFAULT_FROM_EMAIL=no-reply@salonglamournc.com
BRAND_NAME=Salon Glamour NC
BRAND_LOGO_URL=https://salonglamournc.com/site-assets/logo-signature.png
BRAND_PRIMARY_COLOR=#CBA675
SUPPORT_EMAIL=frontdesk@salonglamournc.com
BRAND_SOCIAL_LINKS=[{"name":"Instagram","url":"https://www.instagram.com/salonglamournc"}]

# SMS
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=replace-me
SMS_FROM_NUMBER=+17043202786

# Worker tuning (optional)
EMAIL_QUEUE_MAX_ATTEMPTS=3
EMAIL_QUEUE_RETRY_DELAY_MS=60000
EMAIL_WORKER_POLL_MS=5000
```

> Keep the private key wrapped in quotes and use literal `\n` for new lines so Docker reads it correctly.

`SQUARE_ENVIRONMENT` accepts `sandbox` (defaults to `production`). `SQUARE_BASE_URL` is optional; omit it to use the standard Square domain for the selected environment.
`STYLIST_JWT_SECRET` secures stylist sessions—use a long random string in production.

The messaging stack (SendGrid + Twilio + automation worker) is documented in `docs/email-system.md`.

## Endpoints

| Route                     | Method | Description                                                    |
|---------------------------|--------|----------------------------------------------------------------|
| `/health`                 | GET    | Basic readiness info.                                          |
| `/api/config`             | GET    | Shares timezone + embed URL with the frontend.                 |
| `/api/availability`       | GET    | Proxies to Square `v2/availability/search`.                    |
| `/api/bookings`           | POST   | Proxies to Square `v2/bookings`.                               |
| `/api/google/calendar`    | POST   | Creates a Google Calendar event via service account.           |
| `/api/services`           | GET    | Lists live Square appointment services (cached for 5 minutes). |
| `/api/team`               | GET    | Lists active Square team members for the configured location.  |
| `/api/stylists/login`     | POST   | Authenticates a stylist via email/password/PIN.                |
| `/api/stylists/me`        | GET    | Returns the signed-in stylist profile.                         |
| `/api/stylists/me/bookings` | GET  | Upcoming bookings for the stylist (rounded to 7 days by default). |
| `/api/stylists/me/bookings/:bookingId/notes` | POST | Adds a private note to a booking.                        |

### Messaging + automation endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/messages/email/send` | POST | Fire-and-forget transactional email (optionally scheduled with `sendAt`). |
| `/api/messages/email/campaigns` | POST | Segmented broadcast email that enqueues to the worker. |
| `/api/messages/automations` | POST | Adds an automation job (booking confirmations, win-backs, etc.) to the queue. |
| `/api/messages/sms/broadcast` | POST | Sends a compliant SMS blast via Twilio to an opt-in segment. |
| `/api/messages/queue` | GET | Returns the current email queue snapshot for observability. |

## Local development

```bash
# Run everything
docker compose up --build

# Install dependencies once the api container is up (only needed if bind-mounted)
docker compose exec api npm install
```

The API listens on port `8788` inside Docker. Nginx proxies `/api/*` to it, so the booking UI can call `/api/availability`, `/api/bookings`, `/api/services`, `/api/team`, and `/api/google/calendar` from the browser without exposing secrets.

### Email worker

The automation + campaign queue is processed by `src/workers/emailWorker.js`.

```bash
npm run worker:email              # foreground for debugging
pm2 start src/workers/emailWorker.js --name salon-email-worker   # production suggestion
```

Make sure the worker process shares the same `.env` file as the API so it has SendGrid/Twilio credentials and branding variables.

### Stylist portal

- Stylist accounts are seeded in `api/data/stylists.json`. Default password is `ChangeMe123!` and PIN `1234` for every stylist—change these ASAP by updating the hashes (run `node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('NewPassword', 10));"` inside `api/`).
- Private notes are stored in `api/data/notes.json` and never sent back to Square or Google.
- Set `STYLIST_JWT_SECRET` to a long random value before deploying. Sessions default to 12 hours (`STYLIST_SESSION_TTL_HOURS`).
