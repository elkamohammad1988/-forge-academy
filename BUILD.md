# Build & Run — Forge Academy

## Quick start (development)

```bash
# 1. Install Node 20+
node --version       # should print v20.x or v22.x

# 2. Clone & install
git clone <your-repo-url> forge-academy
cd forge-academy
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — minimum to set:
#   - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
#   - ADMIN_PASSWORD_HASH (or use scripts/create-admin.js below)

# 4. Start the dev server (auto-restarts on file changes)
npm run dev
# → http://localhost:3000
```

The site is fully functional in dev with **no SMTP, no Stripe, no extra config**:
emails are logged to stdout and Stripe checkout buttons gracefully fall back
to the contact form.

## Bootstrap an admin

```bash
node scripts/create-admin.js you@example.com 'a-strong-password' 'Your Name'
```

Then sign in at <http://localhost:3000/admin.html>.

## Tests

```bash
npm test                # run once
npm run test:watch      # watch mode
npm run test -- --coverage   # generate coverage/lcov.info
```

## Linting

```bash
npm run lint
```

## Production build (static asset minification)

```bash
npm run build           # → dist/ with minified css + js + html
```

The `dist/` directory is what you upload to a static host or CDN if running
**without** the Node backend (forms then fall back to the simulated submit
path or you can wire them to Netlify Forms / Formspree).

## Production deployment with Docker

```bash
# Build & run
docker compose up -d --build

# Tail logs
docker compose logs -f

# Open a shell to run the admin bootstrap
docker compose exec forge node scripts/create-admin.js you@example.com 'pw'
```

The SQLite database is persisted to the named volume `forge-data`. Back it up
with `docker run --rm -v forge-data:/data -v $PWD:/backup alpine tar -czf /backup/forge-data.tgz /data`.

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `NODE_ENV` | recommended | `production` in real envs |
| `PORT` | optional | default 3000 |
| `PUBLIC_URL` | required for Stripe | absolute URL of your site |
| `ALLOWED_ORIGINS` | required in prod | comma-separated origins permitted to POST |
| `DB_PATH` | optional | default `./data/forge.db` |
| `JWT_SECRET` | **required** | 32+ random bytes; rotates all sessions if changed |
| `SESSION_TTL_HOURS` | optional | default 720 (30 days) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | optional | use `create-admin.js` instead |
| `SMTP_*` | optional | leave blank in dev; emails log to stdout |
| `EMAIL_FROM`, `EMAIL_TO_OWNER` | recommended | sender + lead-notification recipient |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | enables real checkout + subscription sync |
| `STRIPE_PRICE_*` | optional | one Price ID per plan / period |
| `RATE_LIMIT_*` | optional | sane defaults for forms |

## Stripe checkout setup

1. Create three **subscription** products in Stripe (Kids / Unlimited / Family),
   each with a Monthly and an Annual price.
2. Copy the six Price IDs into `.env` (`STRIPE_PRICE_*`).
3. Add a webhook endpoint at `https://yourdomain/api/checkout/webhook` listening
   for `checkout.session.completed` and `customer.subscription.deleted`.
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Test with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/checkout/webhook`.

## Email setup

Production-grade options:
- **Postmark / SendGrid / Resend / Mailgun** — give you SMTP credentials. Drop them
  into the `SMTP_*` env vars and you're live.
- **Gmail SMTP** — only with an App Password and `SMTP_HOST=smtp.gmail.com`.
- **AWS SES** — `SMTP_HOST=email-smtp.<region>.amazonaws.com`.

Without `SMTP_HOST`, every email is logged to stdout — perfect for dev.
