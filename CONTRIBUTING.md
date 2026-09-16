# Contributing & Customising

You bought a license to run, modify and ship Forge Academy as your own gym
website. This document is **for you, the buyer** — how to get productive
with the codebase, what's safe to change, and what to be careful about.

## TL;DR — first 30 minutes

```bash
git clone <your-private-fork> my-gym
cd my-gym
npm install
npm run setup        # generates .env, seeds demo data, creates admin
npm run dev          # http://localhost:3000
```

Login: the admin email/password you typed during setup. Test as a member
with `demo+sarah@example.test` / `demo-pass-1234`.

## Where to change what

| To change… | Edit… |
|---|---|
| Gym name, contact, hours, address, social | `config/brand.json` |
| Colours, fonts | `config/theme.json` (then re-skin via the CSS tokens in `css/styles.css`) |
| Programs / class titles / pricing | `pricing.html`, `index.html` programs section |
| Weekly schedule | `src/data/schedule.js` (single source of truth — also drives the public timetable, the next-class banner, and pre-filled bookings) |
| Coach bios | `js/app.js` — `COACHES` dictionary, plus `coaches.html` cards |
| Stripe plans | `STRIPE_PRICE_*` env vars; the checkout button mapping is in `pricing.html` |
| HTML email design | `src/lib/email-templates.js` |
| Owner-notification destinations | `.env` — `NOTIFY_SLACK_WEBHOOK`, `NOTIFY_DISCORD_WEBHOOK`, `NOTIFY_TELEGRAM_*`, `NOTIFY_GENERIC_WEBHOOK` |
| Blog posts | drop `.md` files in `content/blog/`, run `npm run blog:build` |
| Database schema | add a new file `src/db/migrations/NNN_description.sql`; it runs automatically on next start |

## Safe to delete

- `content/blog/*.md` — sample posts. Replace with your own.
- `tests/` — if you don't care about CI gates. (Keep them; they pay for
  themselves the first time you change something.)
- `Caddyfile` — only matters if you self-host behind Caddy.
- `_headers`, `.htaccess` — keep whichever applies to your host.

## Don't delete (production essentials)

- `src/db/migrations/` — your data depends on these running.
- `manifest.webmanifest`, `sw.js` — PWA + offline fallback.
- `og-image.svg`, sitemap, robots — SEO essentials.
- `.env.example` — your future-self setup reference.
- The CSP / security meta tags in each HTML head — removing them weakens
  every page.

## Adding a feature

1. **Migration** if it touches the schema: `src/db/migrations/NNN_*.sql`.
2. **Validator** in `src/lib/validators.js` (Zod schema).
3. **Route** in `src/routes/<feature>.js`. Mount it in `src/app.js`.
4. **API client method** in `js/api.js`.
5. **UI** — vanilla JS in the relevant HTML page or `js/app.js`.
6. **Test** in `tests/api.test.js` (or a new file).

Keep dependencies minimal. The whole stack runs on ~12 npm packages. Adding
a heavy front-end framework would change the deployment story dramatically.

## Multi-gym / agency use

This repo is licensed for one business entity. If you want to run a SaaS
across many independent gyms, contact the seller for an Agency licence.
The data model already supports it (see the `actor`/`tenant` pattern in
`audit_log`); a small middleware layer in `src/middleware/` would carry
the rest.

## Reporting bugs

Email the seller via your purchase channel. Include:

- Node version (`node --version`)
- A minimum reproduction (terminal output, browser DevTools console)
- Whether you reproduced it on the unmodified codebase

## Style

- 2-space indent, single quotes, semicolons.
- Prefer plain functions and small modules over classes.
- No comments unless the *why* is non-obvious. The code should read like
  prose; let identifiers do the work.
- Vanilla JS on the frontend — no React, no build pipeline beyond
  optional minification.

Welcome aboard. Build something great.
