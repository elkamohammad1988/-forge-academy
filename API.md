# API Reference — Forge Academy

Base URL: `https://forgemartialarts.co.uk/api` (production) or
`http://localhost:3000/api` (dev).

All POST/PUT/PATCH/DELETE endpoints require the `Origin` header to match one
of `ALLOWED_ORIGINS` (env). Auth is via the `forge_session` HttpOnly cookie.

Bodies are JSON unless noted. Successful responses always include `{ "ok": true, ... }`;
failures include `{ "ok": false, "error": "...", "details"?: ... }` with a 4xx or 5xx status.

## Public

### `GET /api/health`
Returns `{ ok, ts }`. Used by the frontend probe and Docker healthcheck.

### `GET /api/schedule`
Returns the full weekly timetable as `{ ok, schedule: [...] }`.

### `GET /api/schedule/next`
Returns the next class as `{ ok, next: { day, time, prog, ..., starts_at: ISO } }`.

### `POST /api/leads`
Trial / lead-form submission.
```json
{
  "firstName": "Alex", "lastName": "Bennett",
  "email": "alex@example.com", "phone": "07700 900 123",
  "program": "Brazilian Jiu-Jitsu",
  "preferredDay": "Monday", "preferredTime": "Evening (5–8pm)",
  "experience": "Complete beginner",
  "consent": true,
  "_ts": 1715000000000,        // injected by client
  "website": ""                 // honeypot — must be empty
}
```
Response: `{ ok: true, id }`. Triggers two emails (owner notification +
member confirmation). Bot submissions return `{ ok: true, id: 0 }`.

### `POST /api/contact`
General-purpose contact form.
```json
{ "firstName": "Priya", "email": "priya@example.com",
  "topic": "Kids classes", "message": "...", "consent": true }
```

### `POST /api/newsletter`
```json
{ "email": "you@example.com" }
```
Idempotent — re-subscribing reactivates a previously-unsubscribed email.

### `POST /api/newsletter/unsubscribe`
```json
{ "email": "you@example.com" }
```

## Auth

### `POST /api/auth/register`
```json
{ "firstName": "Test", "email": "u@e.com", "password": "min-8-chars", "consent": true }
```
Sets the session cookie. Returns `{ ok, member }`.

### `POST /api/auth/login`
```json
{ "email": "u@e.com", "password": "..." }
```
Returns `{ ok, member }` or 401. Uses constant-time-ish password compare.

### `POST /api/auth/logout`
Clears the session cookie.

### `GET /api/auth/me`
Returns `{ ok, member: null | { id, email, firstName, lastName, plan, role } }`.

## Member (requires session)

### `GET /api/bookings`
List the signed-in member's upcoming bookings.

### `POST /api/bookings`
```json
{ "classDay": 1, "classTime": "18:00", "program": "BJJ" }
```
`classDay` is 0=Sun … 6=Sat. Must match an entry from the schedule.

### `DELETE /api/bookings/:id`
Cancels (sets status='cancelled') a booking owned by the signed-in member.

## Admin (requires `role='admin'` member session)

### `GET /api/admin/stats`
```json
{ "ok": true, "stats": { "leads_total": 42, "leads_today": 3, ... } }
```

### `GET /api/admin/leads?status=new`
Returns up to 200 leads, optionally filtered by status.

### `PATCH /api/admin/leads/:id`
```json
{ "status": "contacted" }
```
Status enum: `new | contacted | booked | closed | spam`.

### `GET /api/admin/contacts`
Returns up to 200 contact messages.

### `GET /api/admin/members`
Returns up to 200 members.

### `GET /api/admin/leads.csv`
Streams a CSV download of every lead in the database.

## Checkout (Stripe)

### `POST /api/checkout/session`
```json
{ "plan": "unlimited", "period": "monthly" }
```
Creates a Stripe Checkout Session. Returns `{ ok, url, id }`. The frontend
then redirects the user to `url`.

### `POST /api/checkout/webhook`
Receives Stripe events. Verifies the signature with `STRIPE_WEBHOOK_SECRET`.
Currently handles:
- `checkout.session.completed` — sets `members.plan` and `stripe_customer_id`
- `customer.subscription.deleted` — clears `members.plan`

## Errors

| Code | Meaning |
|---|---|
| 200 | OK |
| 401 | Not signed in |
| 403 | Cross-origin / wrong role |
| 404 | Resource not found / not owned by caller |
| 409 | Conflict (e.g. duplicate registration) |
| 422 | Validation failed — see `details.fieldErrors` |
| 429 | Rate-limited |
| 500 | Server error |

## Rate limits

- Form endpoints (`/api/leads`, `/api/contact`, `/api/newsletter`):
  100 requests / 15 min / IP (env-tunable).
- Auth endpoints: 20 requests / 15 min / IP.
- Admin & schedule: not rate-limited.
