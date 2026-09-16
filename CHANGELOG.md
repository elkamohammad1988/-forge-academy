# Changelog

All notable changes to this product. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org).

## [2.0.0] — 2026-05-07

### Added — `npm run go-live` — make this site yours in one command

The repo shipped as a polished demo with seeded data and "Forge Manchester"
copy throughout. Buyers had a cluster of separate steps to make it theirs:
fill in `brand.json`, run `brand:apply`, disable `demoMedia`, wipe demo
rows, generate JWT, edit `.env`, create admin. **Now it's one command.**

```bash
npm run go-live
```

The wizard:

1. Asks ~12 questions (gym name, contact, address, social, stats, legal)
2. Writes `config/brand.json` with everything you typed
3. Sets `config/features.json → demoMedia: false` so your uploads
   immediately drive every photo on the site (no Unsplash demo)
4. Runs `scripts/brand-apply.js` so every HTML page, email template,
   sitemap entry and JSON-LD block flips from "Forge Martial Arts
   Academy" to your gym name
5. **Cleans demo data** — drops every member / lead / contact /
   newsletter row matching `demo+*@example.test`, `*@demo.test`,
   `*@example.test`, then orphan-cleans bookings / achievements /
   tokens / push subs / referrals
6. Generates a fresh **`JWT_SECRET`** if `.env` still has the example
   placeholder
7. Updates **`.env`** — `PUBLIC_URL`, `ALLOWED_ORIGINS`,
   `EMAIL_TO_OWNER`, `EMAIL_FROM`, `NODE_ENV=production`
8. Creates your first **admin account** via `create-admin.js`
9. Prints the next-step checklist (sign in URL, where to upload first
   photos, link to Stripe section in DEPLOY_CHECKLIST)

Re-runnable. The brand snapshot lives in `.brand-applied.json` so a
re-run with edits applies cleanly. `npm run brand:revert` rolls back to
the previous snapshot.

### Changed
- Top of `README.md` opens with the `npm run go-live` walkthrough so the
  buyer sees it before any other instructions.

### Why this is the 2.0
Up to v1.x the project was a "configurable demo". With go-live, the
single command makes the codebase **theirs** — the demo data is gone,
the brand is real, the secrets are fresh, the admin exists, and they
can ship to production. The product is finally what it's marketed as:
a one-afternoon launch, not a multi-day setup.

## [1.9.0] — 2026-05-07

### Added — Mancunian palette (city colours, civic symbol)

The brand was already strong red on industrial charcoal — visually right
for Manchester. This release tightens the red to the canonical city tone
and adds three civic accents that are explicitly **Manchester**, not
generic gym design.

- **Primary red shifted** `#C8102E → #DA291C` — true Manchester red,
  shared by both Salford and United, more orange-warmth in the tone.
  All existing UI inherits this automatically through the `--c-blood`
  CSS variable.
- **`--c-sky` (#6CABDD)** — Manchester City sky blue. Used as a
  secondary info accent. New `.text-sky` utility for links on dark
  sections (`section-dark a.text-sky:hover { color: var(--c-bee); }`).
- **`--c-bee` (#FFC72C)** — the worker-bee yellow. The bee predates
  both football clubs and is the actual civic mark of Manchester since
  1842.
- **`--c-brick` (#8B3A2F)** — old cotton-mill terracotta from
  Cottonopolis. Used in `.brick-rule` (a layered red→brick→dark-red
  divider) and available for hover states / depth in light sections.

### Added — Civic flourishes

- **Inline worker-bee SVG** mark (`.bee-mark`) — a clean 24×24 glyph
  shipped as a span you can drop anywhere. Currents to the surrounding
  text colour.
- **"Mancunian since 2014" footer badge** (`.mcr-badge`) — golden
  pill with the bee mark, links to the contact map. Small, optional,
  right-pitched heritage cue rather than a garish flag.
- **`.brick-rule`** — three-stop gradient horizontal rule for warm
  section dividers in light backgrounds.

### Plumbing

- `config/theme.json` declares the four new tokens (`sky`, `skyDark`,
  `bee`, `brick`) with explanatory `$mancunian` comment.
- `scripts/brand-apply.js` knows about the new tokens — when a buyer
  edits `theme.json` and runs `npm run brand:apply`, the four new
  CSS variables are rewritten in `css/styles.css` along with the
  existing palette.

### Migrations
None.

### Backwards compatibility
The red shift is small (within a few hue degrees, same brightness) so
existing photos / overlays / typography contrast remain valid. Run
`npm run brand:check` to preview before committing if you want to
confirm visually.

## [1.8.0] — 2026-05-07

### Added — Photos baked in (no JS, first paint)

The previous round resolved photos via JS after the page hydrated, which
meant a flash of SVG placeholders. Now every public page paints with a
real photo on the very first byte.

- **Hero photo `<img>`** on `index.html` and all four
  `programs/*.html` pages — `fetchpriority="high"`, `decoding="async"`,
  loaded before the optional video upgrade. The dark gradient + radial
  red accent now layer **on top** of the photo via `.hero::after` so
  headlines stay legible at every photo brightness.
- **Coach portraits** baked directly into `coaches.html` as `<img>`
  tags (with an `onerror` fallback that swaps in the initials span).
  Each avatar is now 112 px (was 96), with `:hover scale(1.04)`. Lazy
  loaded below the fold.
- **Programs cards on `index.html`** — each of the four cards now has
  a real photo via `<img class="program-photo">` underneath the dark
  gradient. Hover scales the photo 1.06× and lifts saturation, giving
  the grid a cinematic feel.
- **Photo strip** between the Why and Programs sections —
  full-bleed 4-up cinematic grid, each tile a link to the gallery,
  branded captions on hover. Two-up on mobile, four-up on desktop.

### Programs detail pages

- `programs/bjj.html`, `muay-thai.html`, `boxing.html`, `kids.html` —
  each hero now uses a real on-mat photo per discipline. Replaces the
  flat coloured-radial gradient. CSP allowance added per-page so the
  photos load.

### CSS polish

- New `.coach-avatar-photo` variant — fills the circle with the photo,
  initials are kept as `<span>` fallback if the network drops the URL.
- `.program-photo` + revised `.program-card::before` — proper z-stack
  (photo 0, gradient 1, content 2). The hover transform on the photo
  is decoupled from the card lift, so the card lifts and the photo
  zooms simultaneously without jitter.
- New `.photo-strip` — 2/4-column responsive cinematic grid with
  bottom-anchored captions, brightness pull, hover-scale.

## [1.7.0] — 2026-05-07

### Added — Real photos & video so the demo looks alive

- **Hero video** on `index.html` — full-width muted looping background.
  Probes `/uploads/video/hero.mp4` first (gym's own clip), falls back to
  a curated Pexels CDN sample. Disabled under `prefers-reduced-motion`
  and on data-saver / 2G connections. CSS-cross-faded in once the first
  frame loads so it never pops.
- **`js/photos.js`** — single resolver that hands every image consumer a
  URL using the order: real upload → curated demo (Unsplash) → SVG
  fallback. The buyer flips `config/features.json → demoMedia: false`
  to drop the demo CDN entirely.
- **Coach photos** auto-swap from initials avatars to real portraits on
  `/coaches.html`. Members who upload an avatar override the demo.
- **Gallery** uses the same resolver — admin-uploaded shots win, demo
  fills the rest, SVG placeholders only show when both are off.
- **Video uploads** — `uploads` route now accepts `video/mp4`,
  `video/webm`, `video/quicktime`. New `kind=video` with a 50 MB cap
  (vs 5 MB for images, both env-tunable). Storage abstraction
  whitelists the new MIMEs.
- **Service-worker** stops intercepting third-party media so Unsplash &
  Pexels go through the browser's native cache instead of bloating the
  SW cache and going stale.

### CSP changes

- `index.html`, `gallery.html`, `coaches.html` now allow
  `img-src https://images.unsplash.com` and `media-src https://videos.pexels.com`.
  Other pages unchanged. The buyer can shrink this back to `'self'`
  after replacing every demo photo with their own uploads.

## [1.6.0] — 2026-05-07

### Fixed — Production-blocking issues found during audit

- **Stripe webhook is now idempotent.** New `processed_stripe_events`
  table records every event id; duplicate deliveries return
  `200 received, duplicate:true` without re-running side effects. Without
  this we'd double-grant plans on Stripe's natural retries.
- **Bookings now validate against the live schedule.** `bookings.js`
  was reading the static seed; admin-created classes were 404. Both
  `bookings.js`, `schedule.js` and `ical.js` now share
  `src/data/load-schedule.js` so there's one source of truth.
- **Webhook retry scheduling bug.** Old code stored a `"datetime('now', …)"`
  string as a parameter; retries never fired.
- **`requireSignedWaiver` middleware** gates `POST /api/bookings` and
  `POST /api/pt/book/:id`. Returns `412 Precondition Failed` with
  `{ needs_waiver: true, waiver_id }` so the frontend can route the user
  to sign first. Admin / coach roles are exempt.
- **Static-imported PT / passes confirmation handlers** in the Stripe
  webhook (was a fire-and-forget `import('./pt.js')` whose errors were
  swallowed before Stripe could see a 5xx).

### Added — Subscription lifecycle

- `customer.subscription.updated` → keeps `members.subscription_status`
  in sync (`active` / `past_due` / `paused` / `canceled` / `trialing`)
  with `subscription_current_period_end`.
- `invoice.payment_succeeded` / `invoice.payment_failed` → recorded in
  the new `member_invoices` table; failed invoices flip the member's
  status to `past_due`.
- `charge.refunded` → flags the matching invoice as refunded.

### Added — Operational sanity

- **Retention worker** (`src/lib/retention.js`) wakes every 6 h and
  prunes `audit_log` (>365 d), sent `email_queue` (>30 d),
  `webhook_deliveries` (>90 d), `processed_stripe_events` (>90 d).
  Configurable via `RETENTION_*_DAYS`.
- **Pagination + search on `/api/admin/leads`** — `?limit=`, `?offset=`,
  `?q=` (matches across name/email/phone). Returns `{ total, limit,
  offset }`.
- **Hot-path indexes** — `idx_audit_created`, `idx_email_q_sent`,
  `idx_webhook_deliv_created`, `idx_bookings_member_starts`.

### Added — UX polish

- **Focus trap** on every modal and the mobile drawer.

### Added — Documentation

- **`DEPLOY_CHECKLIST.md`** — 12-section ordered checklist from env
  vars through the day-1 smoke test.

### Migrations
- `010_production_hardening.sql` — `processed_stripe_events`,
  `member_invoices`, `members.subscription_status`,
  `members.subscription_current_period_end`, plus missing indexes.

## [1.5.0] — 2026-05-07

### Added — Production hardening
- **Image upload system** — admin uploads gallery photos, coach avatars,
  blog images via `POST /api/uploads/:kind` (multer multipart). Files
  stored under `/data/uploads/<kind>/`, served from `/uploads/...` with
  7-day cache. The Gallery page now auto-swaps SVG placeholders for real
  uploaded photos when present. Storage abstraction (`src/lib/storage.js`)
  is ready to point at S3/R2 later by re-implementing two functions.
- **Digital liability waiver** — `/api/waivers/*`. A v1.0 default waiver
  is seeded automatically. Members sign once per active waiver via a
  base64 PNG canvas signature; signature + IP + user-agent + timestamp
  are stored as legal evidence. Admin can publish a new version
  (auto-deactivates the previous), and view all signatures for audit.
- **Two-factor authentication (TOTP, RFC 6238)** — fully zero-dependency
  implementation in `src/lib/totp.js` using Node's built-in crypto.
  Endpoints: `/auth/2fa/status`, `/setup`, `/enable`, `/disable`. Login
  flow gates on TOTP if enabled, with bcrypt-hashed one-shot recovery
  codes for lost-device cases.
- **Webhook retry queue with exponential backoff** — failed deliveries
  are scheduled at 1 / 5 / 30 / 120 / 360 minute intervals across 6
  attempts, then dead-lettered. New worker drains due retries every 30s.
- **Production logging** — when `NODE_ENV=production`, access logs are
  written to `./logs/access.log` with daily rotation, 10 MB cap, gzip
  compression of previous days, while still mirroring to stdout for
  `docker logs` / `journalctl`.

### Migrations
- `009_uploads_waivers_2fa.sql` — adds `uploads`, `waivers`,
  `waiver_signatures`, `member_2fa`, plus a `next_attempt_at` column
  on `webhook_deliveries` for the retry queue.

### Dependencies
- `multer` (for upload multipart parsing)
- `rotating-file-stream` (for production access-log rotation)

## [1.4.0] — 2026-05-07

### Added — Revenue, retention, ranks
- **Personal Training (1-on-1) booking** — coaches publish availability
  slots with a price; members book via Stripe Checkout (or directly if
  free / Stripe disabled). Confirmation email + `pt.booked` webhook.
  Tables: `pt_slots`. Stripe webhook now handles `kind=pt`.
- **Belt grading tracker** — `/api/gradings/*` with discipline-aware
  rank catalogues (BJJ white→black + degrees, Muay Thai prajioud,
  Karate kyū/dan, Boxing levels). Admin grants → member timeline +
  current rank + auto-email to the member.
- **Membership pause / vacation hold** — `/api/pauses/*`. Auto-approves
  pauses ≤3 months. Wires into Stripe `pause_collection` so billing
  also pauses for the exact window, and resumes on cancel.
- **Day pass / drop-in** — `/api/passes/checkout` runs a £18 one-off
  Stripe Checkout. Buyer receives a single-use code by email; coach
  redeems via `/api/passes/redeem`.
- **Coach payroll** — `/api/admin/payroll?from=…&to=…` aggregates
  attendance check-ins per coach and applies per-coach rates from
  `COACH_RATES` env, returning daily + totals in pence.
- **Manual waitlist promote** — `POST /api/admin/bookings/:id/promote`.

### Changed
- Stripe webhook now distinguishes subscription / PT / day-pass via
  `metadata.kind` and dispatches to the right post-purchase handler.
- Subscription completion auto-rewards the referrer (`onMemberPaid`).

### Migrations
- `008_pt_grading_pauses.sql` adds `pt_slots`, `gradings`,
  `member_pauses`, `day_passes`.

## [1.3.0] — 2026-05-07

### Added — Engagement & retention layer
- **Web push notifications** — VAPID-signed, with a service-worker push
  handler that displays branded notifications and routes clicks to the
  in-app URL. Member portal has Enable / Test / Disable controls. Run
  `node scripts/vapid-keys.js` once, drop into `.env`, and you're live.
- **Class reminder worker** — every 5 minutes, looks for confirmed
  bookings starting in 50–70 minutes and sends a branded email + a push
  notification. Idempotent via `bookings.reminder_sent_at`.
- **Member referral program** — every member gets a stable code
  (`firstname-XXXX`). Sign-ups via `?ref=<code>` are tracked; when the
  referred member converts to a paid plan, the referrer gets a free
  month credited via the `member_credits` ledger. The member portal
  shows the link, copy button, balance and recent activity.
- **Class detail page** at `/class.html?day=N&time=HH:MM` — full info
  for a single class with live capacity bar, what-to-expect / what-to-bring,
  and a one-tap book or waitlist CTA. Schedule rows now navigate here on
  click (the CTA still goes straight to booking).
- **CSV import** for admins — `POST /api/admin/import/members` and
  `/import/newsletter` accept plain CSV bodies and upsert rows. Wired
  to the admin UI when you build that bit.

### Operations
- Reminder worker boots alongside the drip worker on startup
  (gated by `NODE_ENV !== 'test'`).
- Service worker (`sw.js`) gained `push` + `notificationclick` handlers.
- `?ref=` is now persisted in both sessionStorage **and** a 30-day
  cookie so it survives a sign-up that happens days after the click.

## [1.2.0] — 2026-05-07

### Added — World-class polish
- **Schedule editor** — admin can CRUD the weekly timetable from the UI;
  changes are persisted to `schedule_classes` and read by the public
  `/api/schedule` and the iCal feed. Migration 006.
- **iCal feed** at `/calendar/forge.ics` — 8 weeks of class events for
  Google / Apple / Outlook calendar subscribers, refreshed every 12h.
- **Generic webhook subscriptions** — admin can wire any event
  (`lead.created`, `contact.created`, `booking.confirmed`, etc.) to any
  URL; payloads are HMAC-signed when a secret is set. Replaces the
  single-purpose `notify.js` paths and includes a delivery log.
- **Email drip automation** — every new lead enters a 4-step welcome /
  nudge / kit-tip / win-back sequence. Worker drains the queue every
  60s with retry × 3.
- **Member achievements & streaks** — 9 badges (First Class, 7-day
  streak, 100 classes, etc.) auto-granted on attendance check-in.
  Visible at `GET /api/achievements/me`.
- **GDPR data export + delete** — `GET /api/gdpr/me/export` downloads
  a JSON of every record we hold for the signed-in member;
  `POST /api/gdpr/me/delete` anonymises the account in one click.
  Both surfaced in the member portal's Security tab.
- **i18n framework** — runtime translation via `[data-i18n]` attribute,
  EN + Arabic shipped with full RTL CSS hooks. Per-user language
  persisted, switchable from the footer.
- **PWA install banner** — captures `beforeinstallprompt`, shows a
  branded install card, persists user dismissal.
- **Interactive Leaflet map** on `/contact.html` — replaces the static
  OSM iframe. Custom marker, popup with click-to-call and directions,
  scroll-zoom locked until the user interacts.
- **Capacity bars** on the schedule — live "X of Y left" with
  colour-graded progress bar, "Full · join waitlist" state, CTA
  switches to Waitlist when capacity is reached.
- **Email drip + achievements + webhook dispatch** all wired into the
  existing lead / booking / attendance flows — one POST triggers a
  cascade of: DB insert, SSE push, owner notify (if configured), HTML
  email, drip enqueue, webhook fan-out, audit log entry.
- **Three new content pages**: `reviews.html` (full member stories +
  Google rating link), `gallery.html` (8-tile lightbox gallery with
  branded SVG placeholders), `events.html` (interclub, seminars,
  gradings, socials with RSVP).
- **Four program detail pages** under `/programs/`: BJJ, Muay Thai,
  Boxing, Kids — each with a custom-coloured hero, 4-phase curriculum,
  coach card, and Course JSON-LD.

### Changed
- **Every "interactive-looking" card on `index.html` now navigates
  somewhere real.** Stat-strip cells, Why Forge feature cards, Programs
  cards, and Testimonials are all `<a>` elements with hover/focus
  states. Closes the "dead clicks" gap entirely.
- `nav.notify.js` paths superseded by `webhooks.js`. Slack / Discord /
  Telegram still work via the env vars but are now optional layers on
  top of the generic webhook system.

## [1.1.0] — 2026-05-07

### Added
- **`brand:apply` script** that reads `config/brand.json` + `config/theme.json`
  and does well-anchored find-and-replace across every HTML / manifest /
  sitemap / markdown file, plus regenerates the CSS palette. Idempotent,
  with `--dry-run` and `--revert` flags. The "white-label in two JSON files"
  promise is now actually delivered.
- **Coach role** (`role='coach'`) — separate access tier between member and
  admin.
- **Coach panel** at `/coach.html` — today's roster grouped by class, one-tap
  attendance (attended / late / no-show / excused), date picker for past or
  future days.
- **QR check-in** — members rotate a 24-hour single-use token via
  `POST /api/coach/me/checkin-token`. Coaches paste or scan it via
  `POST /api/coach/scan` to instantly mark the member as attended in their
  next class today. Migration `004_attendance.sql` adds `attendance` and
  `checkin_tokens` tables.
- **Coach-scoped endpoints** under `/api/coach/*` — roster, attendance,
  scan, member's own attendance history.
- **Feature flags** at `config/features.json` — toggle subsystems without
  touching code. Exposed at `GET /api/brand`.
- **Brand + features endpoint** `GET /api/brand` — frontend can hide
  disabled UI and pull display values from one source.
- **Deep health check** `GET /api/health/deep` — verifies DB, SMTP,
  Stripe API, returns 503 if anything fails. For uptime monitors.
- **ROI calculator** at `marketing/roi-calculator.html` — interactive
  break-even tool for buyer-facing demos.
- **Cold-outreach kit** — email templates, IG DM templates, walk-in
  script, objection-handling table, call structure, printable one-pager.
- Demo seed now creates a `coach@demo.test` account and a few attendance
  records so the coach panel is populated on first run.

### Changed
- `PATCH /api/admin/members/:id` now accepts `role: 'coach'` in addition
  to `member` and `admin`.

## [1.0.0] — 2026-05-07

First public release. Production-grade gym website, member portal, admin
dashboard, Stripe checkout, SQLite-backed Node backend, and a static-only
fallback mode.

### Added — Frontend
- Eight HTML pages: home, schedule, pricing, coaches, contact, booking,
  thank-you, 404, plus member portal (`account.html`) and admin
  (`admin.html`).
- Filterable timetable (program × day × level), pricing toggle (monthly ↔
  annual with savings pill), coach detail modals, FAQ accordion.
- Lead form with localStorage draft persistence, honeypot + render-timestamp
  anti-bot, UK phone formatter, live validation.
- `.ics` calendar download generated client-side with 60-min reminder.
- Refer-a-friend share block (copy / WhatsApp / email / Web Share API).
- Cookie consent banner with granular settings modal (essential /
  analytics / advertising) persisted in localStorage.
- Open-now indicator computed live from configured hours; next-class
  countdown banner ticking every 30s.
- Service worker for offline static-shell caching; PWA manifest with
  shortcuts.
- Skip-to-content link, focus-visible rings, aria-live regions throughout.

### Added — Backend
- Express + SQLite (better-sqlite3) backend with versioned migrations
  (`src/db/migrations/*.sql`).
- API endpoints: `leads`, `contact`, `newsletter`, `auth/*`, `bookings/*`,
  `schedule`, `checkout/*`, `admin/*`, `blog`, `metrics`, `openapi.json`.
- JWT-in-HttpOnly-cookie sessions, bcrypt password hashing (cost 12),
  constant-time-ish login.
- Password reset (one-time hashed tokens, 60-minute TTL) and email
  verification flows.
- Stripe Checkout for subscription plans and Stripe Customer Portal for
  member self-service billing. Webhook signature verification with raw
  body.
- Class capacity & waitlist: bookings respect a per-slot cap, full classes
  send members to a numbered waitlist, cancellations auto-promote.
- Admin dashboard with KPI cards, 30-day SVG sparkline, leads / contacts /
  members / audit-log tabs, lead status workflow, role management,
  newsletter broadcast, capacity overrides, CSV export.
- **Server-Sent Events** live admin feed: new leads and contacts pop up
  instantly with a status pill in the header.
- **Owner notifications on new leads** to Slack, Discord, Telegram, or any
  generic JSON webhook (Zapier/Make/n8n).
- HTML email templates (lead confirmation, owner notification, password
  reset, email verification) styled with the brand palette.
- Markdown blog system — drop `content/blog/*.md`, run `npm run blog:build`,
  get static HTML pages with BlogPosting JSON-LD.

### Added — Operations
- Docker + Caddy stack for one-command production deployment with
  Let's Encrypt.
- GitHub Actions CI: lint, test (Node 20 & 22), Docker build, npm audit.
- Vitest + Supertest test suite.
- Online SQLite backup CLI (`npm run backup`) with retention; restore CLI.
- Setup wizard (`npm run setup`) generates `.env`, runs migrations, seeds
  demo data, creates the first admin.
- Demo seed script (40 leads, 5 members, 87 newsletter subs, realistic
  bookings) for instant impressive screenshots.
- Prometheus-style `/api/metrics` endpoint.
- OpenAPI 3.1 spec served at `/api/openapi.json`.

### Added — SEO & Security
- Per-page JSON-LD: LocalBusiness + SportsActivityLocation + WebSite +
  FAQPage on home, Course×4 on schedule, Product×3 on pricing, Person×5
  on coaches, ContactPage + ContactPoint on contact, BreadcrumbList
  everywhere.
- Canonical URLs, hreflang, Open Graph, Twitter Cards on every page.
- Sitemap with `<lastmod>`; `robots.txt` opting out of AI crawlers.
- CSP meta on every page + HTTP headers via `_headers`, `.htaccess`,
  `Caddyfile` (HSTS, X-Content-Type-Options, X-Frame-Options,
  Permissions-Policy, COOP, CORP, full CSP with `frame-ancestors`).
- SRI on the Bootstrap CDN link with `crossorigin="anonymous"`.
- `rel="noopener noreferrer"` on every external `target="_blank"`.
- Origin check on every state-changing request; rate limiting on form &
  auth endpoints; honeypot + render-timestamp anti-bot on every form.

### Added — White-labelling
- `config/brand.json` and `config/theme.json` — change one file to
  rebrand: gym name, contact details, hours, social links, colours,
  fonts. Backend-rendered templates and frontend pages both pull from
  here.

### Documentation
- `README.md`, `BUILD.md`, `DEPLOYMENT.md`, `API.md`, `LICENSE.md`,
  `CONTRIBUTING.md`, plus a `marketing/` kit for resellers.
