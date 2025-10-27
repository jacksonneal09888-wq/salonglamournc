# Salon Glamour API proxy

This folder holds a lightweight Express server that keeps Square + Google credentials off the public site while powering the custom booking UI.

## Environment variables

Copy `.env.example` (below) into the repo root `.env` or export the variables before running Docker:

```
SQUARE_ACCESS_TOKEN=replace-with-live-token
SQUARE_LOCATION_ID=RP38RJ3DZ5D4R
SQUARE_VERSION=2023-12-13
BOOKING_TIME_ZONE=America/New_York
BOOKING_EMBED_URL=https://salonglamournc.com/booking

GOOGLE_SERVICE_ACCOUNT_EMAIL=booking-proxy@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=primary
```

> Keep the private key wrapped in quotes and use literal `\n` for new lines so Docker reads it correctly.

## Endpoints

| Route                     | Method | Description                                                    |
|---------------------------|--------|----------------------------------------------------------------|
| `/health`                 | GET    | Basic readiness info.                                          |
| `/api/config`             | GET    | Shares timezone + embed URL with the frontend.                 |
| `/api/availability`       | GET    | Proxies to Square `v2/availability/search`.                    |
| `/api/bookings`           | POST   | Proxies to Square `v2/bookings`.                               |
| `/api/google/calendar`    | POST   | Creates a Google Calendar event via service account.           |

## Local development

```bash
# Run everything
docker compose up --build

# Install dependencies once the api container is up (only needed if bind-mounted)
docker compose exec api npm install
```

The API listens on port `8788` inside Docker. Nginx proxies `/api/*` to it, so the booking UI can call `/api/availability`, `/api/bookings`, and `/api/google/calendar` from the browser without exposing secrets.
