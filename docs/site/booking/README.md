# Booking sandbox

The `site/booking` folder holds a self-contained UI that lets you test a Square-backed booking flow while staying on the free Appointments plan.

```
site/
|-- booking/
|   |-- index.html   <- UI markup + helper copy
|   |-- styles.css   <- Lightweight utility-inspired tokens
|   \-- app.js       <- Service roster and payload builders
```

Load the page at `/booking/` to preview the experience. Everything runs client-side until you point the config at the new `/api/*` proxy.
Guests now pick their stylist directly (round robin is disabled), and availability queries filter to that choice.

## Runtime configuration

`site/booking/index.html` already includes:

```html
<script>
  window.__BOOKING_CONFIG = {
    squareBookingEndpoint: 'https://salon-worker.jacksonneal09888.workers.dev/api/bookings',
    squareAvailabilityEndpoint: 'https://salon-worker.jacksonneal09888.workers.dev/api/availability',
    servicesEndpoint: 'https://salon-worker.jacksonneal09888.workers.dev/api/services',
    teamEndpoint: 'https://salon-worker.jacksonneal09888.workers.dev/api/team',
    googleCalendarEndpoint: '',
    timeZone: 'America/New_York',
    embedUrl: 'https://salonglamournc.com/booking',
    useMockAvailability: false,
    useMockCatalog: false
  };
</script>
<script type="module" src="./app.js"></script>
```

Set `useMockAvailability` to `false` once the proxy is configured so the UI starts hitting live Square availability.

## API proxy

`docker-compose.yml` now launches a `node:20` container (`salon_api`) that exposes:

| Method | Route                  | Purpose                                  |
| ------ | ---------------------- | ---------------------------------------- |
| GET    | `/api/availability`    | Calls Square `v2/availability/search`.   |
| POST   | `/api/bookings`        | Calls Square `v2/bookings`.              |
| POST   | `/api/google/calendar` | Inserts a Google Calendar event.         |
| GET    | `/health`              | Readiness for Cloudflared/nginx checks.  |

Fill the new env vars in `.env` (copied from `api/.env.example`) so the proxy can talk to Square + Google. The frontend never sees these secrets.

Run everything with:

```bash
docker compose up --build
docker compose exec api npm install   # first run only
```

Visit `http://localhost:8080/booking/` to load the UI, and the XHR requests will flow to `/api/*`.

## Square integration notes

1. **Availability** – `/api/availability` already shapes the request/response for [`v2/availability/search`](https://developer.squareup.com/reference/square/availability-api/search-availability). The browser sends service variation + team member ids so the proxy can build the query.
2. **Bookings** – the UI posts the booking payload to `/api/bookings`, and that proxy forwards it to [`CreateBooking`](https://developer.squareup.com/reference/square/booking-api/create-booking). Location + idempotency are enforced server-side.
3. **Roster sync** – you can still hard-code services/stylists in `app.js` for now; later swap them for fetches to your backend if you want the roster to stay in sync with Square Catalog/Team.

> Tip: keep the UI static and do all credentialed calls in your backend so you can stay on the free Appointments tier.

## Google Calendar hook

`/api/google/calendar` uses a Google service account to call [`Events.insert`](https://developers.google.com/calendar/api/v3/reference/events/insert). Share the target calendar with the service account and provide:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_KEY
GOOGLE_CALENDAR_ID
```

If you prefer delegated OAuth per stylist, repurpose this endpoint to accept a stylist ID and pull the right refresh token before calling Google.

## Embedding on salonglamournc.com

* Link the existing "Book Now" buttons to `/booking/`.
* Or embed the UI inside a modal/iframe:

```html
<iframe src="/booking/" title="Salon Glamour NC booking" class="booking-frame"></iframe>
```

Add a route or Cloudflare rule so `salonglamournc.com/booking` serves `site/booking/index.html`.

## Next steps

1. Connect real services/staff via fetch to your backend.
2. Flip `useMockAvailability` to `false` once `/api/availability` is live.
3. Add SMS/email confirmations (Twilio, Resend, Brevo, etc.) in the API after both Square + Google succeed so guests get a branded receipt.
