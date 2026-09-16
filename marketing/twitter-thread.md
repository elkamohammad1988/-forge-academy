# Twitter / X thread — launch template

A 9-tweet thread you can post when the listing goes live. Mix the
screenshots from `screenshots-checklist.md` into tweets 2-8.

---

**1/**
I built a complete production gym website + backend.

8 pages. Stripe Checkout. Live admin feed. Member portal. SQLite. Docker.

Ships today for $2,000 — yours forever. 🧵

[Hero screenshot #1]

---

**2/**
The whole **public site** is real. Schedule filterable by program / day / level. Pricing toggles between monthly and annual. Coaches open a bio modal. Booking form pre-fills from the schedule.

Every click goes somewhere.

[Schedule screenshot #2]

---

**3/**
**Stripe Checkout for subscriptions** + **Stripe Customer Portal** for self-serve billing. Webhook auto-syncs the subscription to the member record.

You configure six Stripe Price IDs in `.env`. Done.

[Pricing screenshot #3]

---

**4/**
Admin dashboard with KPI cards, a 30-day SVG sparkline, leads / contacts / members / audit-log tabs, role management, status workflow, CSV export, and a **newsletter broadcast** to all active subscribers.

[Admin screenshot #7]

---

**5/**
The wow-moment: a **Server-Sent Events live feed**.

Submit a lead in one tab. The admin dashboard in the other tab pops a toast in real time. Plus: Slack / Discord / Telegram pings the moment the lead lands.

[GIF or live-feed screenshot]

---

**6/**
**Member portal** with password reset, email verification, profile editing, change-password, upcoming bookings (with cancel + waitlist auto-promotion), and a one-click route into the Stripe Customer Portal.

[Member dashboard screenshot #6]

---

**7/**
**White-label in 2 JSON files.**

Edit `config/brand.json` (name, hours, contact, social, address) and `config/theme.json` (colours, fonts). Restart. The whole site rebrands — including JSON-LD structured data and HTML emails.

[Brand JSON screenshot]

---

**8/**
**Security baked in**:
- CSP on every page + via HTTP headers
- SRI on Bootstrap CDN
- bcrypt + JWT in HttpOnly cookies
- Rate limiting + honeypot anti-bot
- Origin checks on every state-changing request

---

**9/**
$2,000. One-time. You own it.

- Single-gym commercial licence
- 30 days of email support
- 14-day money-back guarantee
- Free updates within v1.x

Forge Academy has you live this afternoon.

🔗 [link to listing]
