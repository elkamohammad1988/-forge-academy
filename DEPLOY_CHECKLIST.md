# Production deployment checklist — Forge Academy

A pragmatic, ordered checklist. Tick every box before flipping the DNS.

## 1 · Environment

- [ ] `NODE_ENV=production` in the runtime
- [ ] `PUBLIC_URL` set to the canonical https URL (no trailing slash)
- [ ] `ALLOWED_ORIGINS` includes the production URL **only** (and staging
      if you have one)
- [ ] `JWT_SECRET` regenerated for production:
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- [ ] `DB_PATH` points at a path on a persistent volume / disk
- [ ] `UPLOAD_DIR` points at a persistent volume (or change to S3 in
      `src/lib/storage.js`)
- [ ] `LOG_DIR` (defaults to `./logs`) lives on a persistent volume so
      access logs survive restarts

## 2 · Email

- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` configured
- [ ] `EMAIL_FROM` uses a domain you control (set up SPF + DKIM)
- [ ] `EMAIL_TO_OWNER` set to the inbox that actually reads new-lead alerts
- [ ] Test deliverability with one real signup; confirm it arrives in the
      inbox (not spam)
- [ ] Verify the "Verify your email" + "Reset password" links resolve to
      `${PUBLIC_URL}/account.html?...` correctly

## 3 · Stripe

- [ ] `STRIPE_SECRET_KEY` is a **live** key (`sk_live_…`), not test
- [ ] All six `STRIPE_PRICE_*` env vars point to live Price IDs
- [ ] Webhook endpoint registered at `${PUBLIC_URL}/api/checkout/webhook`
      with these events:
      - `checkout.session.completed`
      - `customer.subscription.updated`
      - `customer.subscription.deleted`
      - `invoice.payment_succeeded`
      - `invoice.payment_failed`
      - `charge.refunded`
- [ ] `STRIPE_WEBHOOK_SECRET` from that endpoint is in env
- [ ] Test with `stripe listen --forward-to https://yourdomain/api/checkout/webhook`
      and a `4242 4242 4242 4242` test charge — confirm the member's plan
      flips to "active" and a row lands in `member_invoices`

## 4 · 2FA / Push / Webhooks

- [ ] Run `node scripts/vapid-keys.js` once, copy the pair into
      `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
- [ ] `VAPID_SUBJECT` is a real `mailto:` you control
- [ ] At least one outbound webhook subscription configured if you want
      Slack/Discord/CRM pings (`/admin.html → Webhooks`)

## 5 · Database

- [ ] `npm run db:init` runs cleanly (migrations 001–010 apply)
- [ ] First admin created with `node scripts/create-admin.js`
- [ ] **NEW**: confirm `processed_stripe_events` table exists (idempotency
      gate; without it duplicate webhook deliveries will double-charge state)
- [ ] **NEW**: confirm `members.subscription_status` and
      `subscription_current_period_end` columns exist
- [ ] **NEW**: confirm `member_invoices` exists for invoice audit trail
- [ ] Daily backup configured (`crontab` → `npm run backup`, kept ≥14 days)
- [ ] Restore drill done at least once on a test box

## 6 · Branding

- [ ] `config/brand.json` reflects your gym (name, contact, hours,
      address, social, stats, legal)
- [ ] `config/theme.json` colour palette matches your visual identity
- [ ] `npm run brand:check` to preview, then `npm run brand:apply`
- [ ] `npm run brand:revert` snapshot saved to `.brand-applied.json` so
      future re-runs are diffable
- [ ] Real `og-image.svg` (or `.png`) sized 1200×630 with your brand
- [ ] First batch of real photos uploaded via `/admin.html → Gallery` so
      the gallery isn't SVG placeholders
- [ ] Coach profiles replaced with your real staff — the shipped coaches
      and their credentials are demo personas, not verified people. They
      live in `coaches.html`, `programs/*.html` and the `COACHES` object
      in `js/app.js`

## 7 · Security

- [ ] Reverse proxy (Caddy / Nginx) terminates TLS with a real cert
- [ ] HTTP → HTTPS redirect in place
- [ ] `_headers` (Netlify/Cloudflare) **or** `.htaccess` (Apache)
      **or** the included `Caddyfile` is the source of HTTP security
      headers — pick one and verify with
      [securityheaders.com](https://securityheaders.com) — target A+
- [ ] CSP doesn't error in DevTools console on the live site
- [ ] Rate limit env defaults reviewed (`RATE_LIMIT_*`)
- [ ] First admin's password is **not** the demo seed value
- [ ] `ADMIN_PASSWORD_HASH` removed from `.env` once the admin account
      is created (the row in `members` is the source of truth)
- [ ] 2FA enabled on every admin account

## 8 · SEO

- [ ] `sitemap.xml` URLs match the live domain and reachable
- [ ] `robots.txt` allows crawl, points at sitemap, opts out of AI
      training crawlers (already configured)
- [ ] Google Search Console verified, sitemap submitted
- [ ] Bing Webmaster Tools (optional)
- [ ] Per-page JSON-LD validates in [Google's Rich Results test](https://search.google.com/test/rich-results)
- [ ] OpenGraph preview rendered correctly on
      [opengraph.xyz](https://www.opengraph.xyz)

## 9 · Legal

- [ ] Active waiver in `/api/waivers/current` reflects your insurance
      requirements (publish a new version via `/admin.html → Waivers`
      before opening to the public)
- [ ] Privacy + Terms + Cookie modals on `index.html` reviewed by
      whoever signs off on legal at your gym
- [ ] Contact-form data retention period in the privacy modal matches
      what you actually configured (default: 24 months)

## 10 · Operations

- [ ] `/api/health` returns 200 to your uptime monitor
- [ ] `/api/health/deep` returns 200 (DB + SMTP + Stripe all green)
- [ ] `/api/metrics` scraped if you run Prometheus
- [ ] Log rotation working: `./logs/access.log.20YY-MM-DD.gz` files
      appear after a day
- [ ] Retention worker logged "✓ retention sweep" once after the first
      hour of uptime (or earlier on first boot)
- [ ] Background workers all started (look for "✓ Forge server
      listening" + the worker startup messages on boot)
- [ ] Demo data wiped: `WIPE=1 node scripts/seed-demo.js` then comment
      out, **or** delete the `demo-*@example.test` rows manually before
      go-live so they don't pollute admin stats

## 11 · Smoke test (live URL)

In one sitting on the live domain:

1. Submit the trial form on `/booking.html` — receive owner email + member
   confirmation + see lead in `/admin.html`.
2. Sign up at `/account.html` — verify email link works.
3. Sign the waiver from the Security tab.
4. Browse `/schedule.html` — book a class via `/class.html`.
5. Check the "Notifications" tab → enable push → receive a test push.
6. Buy a £18 day pass → receive code by email.
7. Subscribe to the Unlimited plan with a real card.
8. Open the Stripe Customer Portal from the Membership tab.
9. Cancel the subscription via the portal → admin badge flips to
   `canceled`.
10. Open `/admin.html` — see the lead, the booking, the invoice row.
11. Open `/coach.html` (with a coach account) — see the booking on the
    roster; tap "Attended" → member's badge progress should update.
12. Subscribe a Slack/Discord webhook and submit another lead — the
    notification should land within seconds.

If all 12 pass: you're live. Tell the gym owner. Refresh the listing.

## 12 · Day-2 monitoring

- Watch `/api/admin/audit` for unusual entries
- Watch `webhook_deliveries` for stuck retries (admin → Webhooks tab)
- Watch `email_queue` for failed sends (`failed_at IS NOT NULL`)
- Watch members in `subscription_status = 'past_due'` — those are the
  emails that need a friendly nudge
