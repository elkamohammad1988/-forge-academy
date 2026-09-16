# Forge Martial Arts Academy — Manchester

A premium, mobile-first, conversion-focused martial-arts gym website **plus
a full Node.js backend** (member portal, admin dashboard, Stripe checkout,
SQLite persistence). Production-ready, dual-mode: ship the static folder for
zero-backend deployments, or run the Express server for the real product.

---

## ▶ Make this site yours — one command

```bash
npm install
npm run go-live
```

The wizard asks for your gym's name, address, contact, social links and a
first-admin password. It then:

- writes `config/brand.json`,
- runs `brand:apply` to swap "Forge Martial Arts Academy" for your gym
  name across every HTML page, email template and JSON-LD block,
- disables `demoMedia` (your uploads now drive every photo on the site),
- wipes any seeded demo data (`demo+*@example.test`, `*@demo.test`, …),
- generates a fresh `JWT_SECRET` if `.env` doesn't have a real one,
- updates `.env` with your public URL + owner email,
- creates your first admin account.

Re-runnable. Roll back any time with `npm run brand:revert`.

After it finishes:

```bash
npm run dev
# → your URL → /admin.html → Gallery / Coaches → upload your real photos
```

The full pre-flight is in **[DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md)** —
12 ordered sections, tick every box before flipping DNS.

---

## Two ways to run it

**Static mode** — the original landing page experience, zero dependencies:
```bash
# just open index.html in a browser, or:
npx serve .
```
Forms simulate submission and redirect to `thank-you.html`. Drafts persist in
localStorage. No backend needed.

**Full-stack mode** — the real product:
```bash
npm install
cp .env.example .env
# edit .env — minimum: JWT_SECRET
npm run dev          # http://localhost:3000
```
Forms POST to `/api/*`, leads land in SQLite, owner gets an email, member can
log in, admin sees the dashboard, Stripe checkout works.

The frontend probes `/api/health` on load. If the backend is reachable, it
uses the API; otherwise it gracefully falls back to the static behaviour.
**Same files, two modes.**

## File structure

```
forge-academy/
├── Frontend (static)
│   ├── index.html              ← Home / landing page
│   ├── schedule.html           ← Filterable weekly timetable
│   ├── pricing.html            ← Membership tiers (with Stripe checkout)
│   ├── coaches.html            ← Coach grid + bio modals
│   ├── contact.html            ← Contact form + map
│   ├── booking.html            ← Free trial booking
│   ├── thank-you.html          ← Confirmation + .ics + referral
│   ├── account.html            ← Member portal (login / dashboard / bookings)
│   ├── admin.html              ← Admin dashboard
│   ├── 404.html
│   ├── css/styles.css          ← One shared design system
│   ├── js/api.js               ← Frontend API client
│   ├── js/app.js               ← Vanilla JS runtime
│   ├── manifest.webmanifest
│   ├── sw.js                   ← Offline cache
│   ├── og-image.svg
│   ├── sitemap.xml, robots.txt
│   ├── _headers, .htaccess     ← HTTP security headers
│
├── Backend (Node.js)
│   ├── server.js               ← Entry point
│   ├── src/app.js              ← Express app
│   ├── src/db.js               ← SQLite + schema (better-sqlite3)
│   ├── src/data/schedule.js    ← Single source of truth for the timetable
│   ├── src/lib/
│   │   ├── auth.js             ← JWT + bcrypt
│   │   ├── email.js            ← nodemailer wrapper
│   │   ├── stripe.js           ← Stripe SDK wrapper
│   │   └── validators.js       ← Zod schemas
│   ├── src/middleware/
│   │   ├── auth.js             ← Session loader + role guards
│   │   └── origin.js           ← Cross-origin POST blocker
│   └── src/routes/
│       ├── leads.js            ← Trial form ingestion
│       ├── contact.js          ← Contact form
│       ├── newsletter.js       ← Subscribe / unsubscribe
│       ├── auth.js             ← Register / login / me / logout
│       ├── bookings.js         ← Member-owned class bookings
│       ├── schedule.js         ← Public timetable + next-class
│       ├── checkout.js         ← Stripe Checkout + webhooks
│       └── admin.js            ← Stats, leads, contacts, members, CSV export
│
├── Tests, build, deploy
│   ├── tests/api.test.js       ← Vitest + Supertest suite
│   ├── vitest.config.js
│   ├── eslint.config.js
│   ├── scripts/create-admin.js ← CLI to bootstrap an admin user
│   ├── scripts/build-html.js   ← Production HTML build
│   ├── Dockerfile, .dockerignore
│   ├── docker-compose.yml
│   ├── Caddyfile               ← Optional reverse proxy with auto-HTTPS
│   ├── .github/workflows/ci.yml ← Lint + test + Docker build + npm audit
│   ├── .env.example
│
└── Docs
    ├── README.md (this file)
    ├── BUILD.md                ← Local dev + production build
    ├── DEPLOYMENT.md           ← Recipes for VPS / Render / Cloudflare / S3
    └── API.md                  ← Full API reference
```

## What's in this round (sale-ready polish)

- **`brand:apply` actually rebrands the codebase** — `npm run brand:apply` reads
  `config/brand.json` + `config/theme.json`, does well-anchored string
  replacements across every HTML/manifest/sitemap/markdown file, regenerates
  the CSS palette from the theme, and saves a snapshot for `brand:revert`.
  The marketing claim ("white-label in two JSON files") is now literally true.
- **Coach role + class roster + QR check-in** — members with `role='coach'`
  (or admin) get [coach.html](coach.html): today's roster grouped by class,
  one-tap attendance buttons (attended / late / no-show / excused), and a
  scan box where pasting a member's rotating QR token marks them as attended
  in their next class today. Members rotate their own token via
  `POST /api/coach/me/checkin-token` (24-hour TTL, single-use).
- **Feature flags** — [config/features.json](config/features.json) toggles
  whole subsystems on/off (member portal, coach panel, live feed, Stripe
  checkout, Stripe portal, newsletter broadcast, blog, referrals, waitlist,
  check-in, analytics). Surfaced via `GET /api/brand` so the frontend can
  hide unused UI.
- **`GET /api/brand`** — public-safe brand + feature snapshot for the SPA-style
  pages.
- **`GET /api/health/deep`** — verifies DB connectivity, SMTP transporter,
  Stripe API access, returns 503 if anything is unhealthy. Drop into your
  uptime monitor.
- **ROI calculator** at [marketing/roi-calculator.html](marketing/roi-calculator.html)
  — interactive break-even calculator buyers run on their own numbers.
- **Cold-outreach kit** — [outreach-templates.md](marketing/outreach-templates.md)
  (cold email, IG DM, in-person walk-in, objection handling, call structure)
  and [one-pager.md](marketing/one-pager.md) (printable handout).

## What's in the previous round (auth maturity + ops + content)

- **Password reset** — `/api/auth/forgot` + `/api/auth/reset`. Tokens are hashed
  before storage; the raw token only exists in the email link, valid 60 minutes.
- **Email verification** — `/api/auth/verify-email` + `/api/auth/verify-email/resend`.
  Auto-sent on registration; banner on the dashboard prompts unverified members.
- **Profile editing + change password** — `PATCH /api/auth/profile`,
  `POST /api/auth/change-password`, with constant-time current-password check.
- **Stripe billing portal** — `POST /api/checkout/portal` opens the official
  Stripe customer portal for subscribers (manage payment, invoices, cancel).
- **Class capacity & waitlist** — bookings respect a per-slot cap (default 20,
  override via `PUT /api/admin/capacity`). When full, members join a numbered
  waitlist. Cancelling a confirmed booking auto-promotes the next waitlist member.
- **Lead notes & timeline** — owner can attach notes to a lead via `/api/admin/leads/:id/notes`.
- **Newsletter broadcast** — `POST /api/admin/newsletter/broadcast` sends to all
  active subscribers (or just the admin in test mode), with auto-appended
  unsubscribe link.
- **Audit log endpoint** — `/api/admin/audit` surfaces the recent action history
  (who, what, when, IP).
- **Database migrations** — versioned `.sql` files in `src/db/migrations/`,
  applied automatically on startup, tracked in `schema_migrations`.
- **Online backup CLI** — `npm run backup` uses SQLite's `.backup` API (safe
  while the server runs) with retention. `npm run restore <file>` for recovery.
- **Markdown blog** — drop `content/blog/*.md` files (with YAML frontmatter),
  run `npm run blog:build`, get `blog/<slug>.html` + `blog.html` index, each
  with BlogPosting JSON-LD. Three sample posts shipped.
- **OpenAPI 3.1 spec** at `/api/openapi.json` (drop into Postman / Bruno / Stoplight).
- **Prometheus metrics** at `/api/metrics` (uptime, memory, table row counts).

## What it does end-to-end

- A visitor lands on `index.html`, sees the hero + live "next class" banner.
- They fill the inline trial form. The frontend POSTs to `/api/leads`.
- The backend validates, stores it in SQLite, sends two emails (owner notification
  + member confirmation), and returns success.
- The visitor lands on `thank-you.html`, downloads the `.ics` calendar invite
  (with 60-min reminder), shares the referral link, and the page personalises with
  their name and chosen program.
- A returning visitor browses `/schedule.html`, filters by program/day/level,
  taps "Book" — the link pre-fills `/booking.html` with the class details.
- They sign up at `/account.html`, see their upcoming bookings, manage their
  membership.
- A member buys a plan at `/pricing.html` — Stripe Checkout opens, they pay,
  webhook updates `members.plan` automatically.
- The owner signs in at `/admin.html`, sees lead/contact/member stats, marks
  leads as `contacted` / `booked` / `closed`, exports CSV.
- All of this works **with no JavaScript framework**, **no build step required**,
  and the database is a single SQLite file.

## Frontend runtime features (`js/app.js`)

FAQ accordion, smooth-scroll, sticky header shadow, scroll-progress bar, mobile
drawer, modals, toasts, reveal-on-scroll, animated stat counters,
form validation + UK phone formatting, **draft persistence** in localStorage,
**cookie consent** banner with granular settings, **open-now indicator**
(live from configured hours), **next-class countdown** banner ticking every
30s, **schedule filtering** with three dimensions, **pricing toggle**
(monthly ↔ annual + save pill), **coach modal** auto-built from JS data,
**newsletter signup**, **.ics calendar download** generated client-side with
60-min VALARM, **refer-a-friend** link generator with copy / WhatsApp / email /
Web Share API, **service worker** for offline static-shell caching,
**skip-to-content** for a11y, **referral attribution** persisting `?ref=`
across the booking flow, and **graceful API fallback** when no backend is up.

## Security

- **CSP meta** on every page + **HTTP headers** delivered by `_headers`,
  `.htaccess`, and `Caddyfile` (HSTS, X-Frame-Options, Permissions-Policy,
  Cross-Origin-* headers, full CSP with `frame-ancestors`)
- **SRI** on the Bootstrap CDN link with `crossorigin="anonymous"`
- **`rel="noopener noreferrer"`** on every external link with `target="_blank"`
- **Origin check** on every POST/PUT/PATCH/DELETE
- **Rate limiting** (form 100/15min, auth 20/15min)
- **Honeypot field** + **render-timestamp** on every form (silently drops bots)
- **HTML-escape helper** used wherever JS injects markup
- **bcrypt** (cost 12) for member passwords, **JWT** in HttpOnly cookies
- **Constant-time-ish login** so timing doesn't leak email existence
- **Input validation** with Zod on every endpoint
- **Prepared statements** everywhere via better-sqlite3
- **Stripe webhook signature** verification with raw body
- **`.htaccess`** blocks dotfiles, backup files, forces HTTPS

## SEO

- Per-page **JSON-LD**: LocalBusiness + SportsActivityLocation + WebSite +
  FAQPage on home, Course×4 on schedule, Product×3 with monthly
  UnitPriceSpecification on pricing, Person×5 on coaches,
  ContactPage + ContactPoint on contact, BreadcrumbList on every page
- **Canonical URLs** + `hreflang="en-GB"` + `x-default` on every indexable page
- **Open Graph + Twitter Cards** with `og-image.svg` (1200×630) on every page
- `sitemap.xml` with `<lastmod>` and `xhtml:link` alternates
- `robots.txt` opts out of AI training crawlers (GPTBot, ClaudeBot, CCBot,
  Google-Extended, PerplexityBot)
- PWA `manifest.webmanifest` with shortcuts to Booking and Schedule

## Tests

```bash
npm test                # vitest + supertest covering every API endpoint
npm test -- --coverage  # generate lcov report
```

## Documentation

- **[BUILD.md](BUILD.md)** — local dev, env vars, admin bootstrap, Stripe setup
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Docker + Caddy on a VPS, static-only
  on Netlify/Cloudflare Pages, Render/Railway/Fly.io recipes
- **[API.md](API.md)** — every endpoint, request/response shape, error codes
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to customise, what's safe to
  delete, where to add features
- **[CHANGELOG.md](CHANGELOG.md)** — versioned release notes
- **[LICENSE.md](LICENSE.md)** — single-business commercial licence terms
- **[marketing/](marketing/)** — sales-page HTML, listing copy, video script,
  screenshots checklist, Twitter launch thread

## Sell-it-for-yourself reseller kit

- **[marketing/sales-page.html](marketing/sales-page.html)** — drop-in
  Gumroad/LemonSqueezy-style listing page (open in browser to preview)
- **[marketing/listing-copy.md](marketing/listing-copy.md)** — title,
  short/long descriptions, tags, sidebar bullets ready to paste
- **[marketing/setup-video-script.md](marketing/setup-video-script.md)** —
  2.5-minute voice-over walkthrough, scene by scene
- **[marketing/screenshots-checklist.md](marketing/screenshots-checklist.md)** —
  what to capture and in what order
- **[marketing/twitter-thread.md](marketing/twitter-thread.md)** — 9-tweet
  launch thread template

## Quick start (the wizard)

```bash
npm install
npm run setup          # generates .env, runs migrations,
                       # seeds 40 demo leads + 5 members + bookings,
                       # creates an admin account
npm run dev            # http://localhost:3000
```

Demo logins after `npm run setup`:
- Admin: typed during setup
- Member: `demo+sarah@example.test` / `demo-pass-1234`

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari, Samsung Internet).
The CSS uses `clamp()`, custom properties, `backdrop-filter`, and
`IntersectionObserver` — all supported in browsers from 2020 onwards.
The service worker degrades gracefully (no-op on `file://`).
