# Deployment Recipes — Forge Academy

This project ships in two deployment shapes:

1. **Static-only** — drop the folder onto Netlify / Cloudflare Pages / S3.
   Forms fall back to the simulated-submit + redirect path. No backend needed.
2. **Full-stack** — Node.js + SQLite. Real form persistence, member portal,
   admin dashboard, Stripe checkout. This is what you want for a real product.

---

## Recipe 1 — Static (zero backend)

Best for: marketing-only sites, demos, or wiring forms to a third-party service
(Netlify Forms, Formspree, GoHighLevel webhook).

```bash
# Build minified static assets
npm install
npm run build

# Deploy ./dist/ to:
#   - Netlify:           drag-drop dist/ into Netlify, or `netlify deploy --dir=dist --prod`
#   - Cloudflare Pages:  point Pages at your repo, build = `npm run build`, output = `dist`
#   - Vercel:            similar — set framework to "Other", output = `dist`
#   - S3 + CloudFront:   `aws s3 sync dist/ s3://your-bucket/ --delete`
```

The `_headers` file (Netlify / Cloudflare) and `.htaccess` (Apache) deliver the
HTTP-level security headers automatically.

To wire forms to a third-party CRM, edit the `setTimeout(done, 650)` fallback
in `js/app.js` to `fetch()` your webhook URL.

---

## Recipe 2 — Single VPS with Docker + Caddy (recommended)

Best for: full-stack production, ~£5/mo VPS (Hetzner, DigitalOcean, OVH).

```bash
# On your VPS
git clone <repo> /opt/forge-academy
cd /opt/forge-academy
cp .env.example .env  &&  vim .env   # fill JWT_SECRET, SMTP_*, STRIPE_*

# Uncomment the caddy service in docker-compose.yml,
# point your DNS A record at the VPS IP, then:
docker compose up -d --build

# Bootstrap admin
docker compose exec forge node scripts/create-admin.js you@example.com 'strong-pw'
```

Caddy fetches a Let's Encrypt cert automatically. Your site is now at
`https://forgemartialarts.co.uk` with HTTPS, full headers, and a healthcheck.

### Backup

SQLite ships with `.backup` — schedule it via cron in the container, or rely
on volume snapshots from your VPS provider.

```bash
docker compose exec forge sh -c 'sqlite3 /data/forge.db ".backup /data/backup-$(date +%F).db"'
```

---

## Recipe 3 — Render / Railway / Fly.io

Push to a Git repo and connect any of these:

- **Render**: detect `package.json`, build = `npm ci`, start = `npm start`,
  add a persistent disk mounted at `/app/data`, set env vars in the dashboard.
- **Railway**: Dockerfile auto-detected, configure a Volume at `/data`,
  set `DB_PATH=/data/forge.db`.
- **Fly.io**: `fly launch` then `fly volumes create forge_data --size 1 --region lhr`,
  attach with `mounts.source = "forge_data"`, `destination = "/data"` in
  `fly.toml`.

---

## Recipe 4 — PaaS that doesn't allow long-running processes (Cloudflare Workers, Vercel Edge)

Use **Recipe 1** for the frontend and put the API on Workers / Lambda / Vercel
Functions. The frontend `js/api.js` already abstracts the URL — point it at
your API origin via `BASE` and CORS-allow your static origin.

---

## DNS

```
forgemartialarts.co.uk        A    <vps-ip>     (proxy off if using Cloudflare with Caddy)
www.forgemartialarts.co.uk    A    <vps-ip>     (Caddyfile redirects to apex)
```

If you front everything with Cloudflare instead of Caddy, set DNS to **Proxied**
and use Cloudflare's Full-strict SSL with an origin certificate.

---

## Post-deploy checklist

- [ ] DNS resolves; HTTPS cert live (`curl -I https://forgemartialarts.co.uk`)
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] Submit a test lead from `/booking.html` — appears in admin dashboard
- [ ] Email lands in your inbox (check `EMAIL_TO_OWNER` config)
- [ ] Stripe test card `4242 4242 4242 4242` completes — webhook updates the member
- [ ] Lighthouse scores: SEO 100, Best Practices 100, Performance > 90
- [ ] [securityheaders.com](https://securityheaders.com) scan — A or A+
- [ ] [Mozilla Observatory](https://observatory.mozilla.org) — A or A+
- [ ] sitemap.xml accessible; submitted to Google Search Console
- [ ] robots.txt loaded; tested in GSC
- [ ] Cookie banner shows; preferences persist across visits
- [ ] Add a daily SQLite backup cron
