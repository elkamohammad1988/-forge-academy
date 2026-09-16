# Setup video — voice-over script (target: 2 min 30 sec)

A first-time-buyer walkthrough you can record in OBS, narrate, and upload
alongside the listing. Aim for under 3 minutes; show the wow moments.

---

**[0:00 — Title card, 3 sec]**

> Forge Academy. From zero to a live gym website in two and a half minutes.

---

**[0:03 — Terminal, fresh clone]**

```bash
git clone forge-academy my-gym
cd my-gym
```

> "I just cloned the repo. The first thing I'll do is run `npm install` —
> small tree, twelve runtime packages, takes about twenty seconds."

```bash
npm install
```

---

**[0:25 — Setup wizard]**

> "Now the magic. `npm run setup` walks me through everything."

```bash
npm run setup
```

> "It generates a JWT secret. Asks me for the public URL. Owner email
> for new-lead notifications. I hit yes to seed forty realistic demo
> leads — that's how the screenshots in the listing look so alive. And
> finally I create my admin account."

---

**[0:55 — Start the dev server]**

```bash
npm run dev
```

> "Server's up. Open `localhost:3000`."

**[Cut to browser — homepage]**

> "Notice the live banner up top — it's already counting down to the next
> class, computed from the schedule data. Stat counters animate. Every
> button goes somewhere real."

---

**[1:15 — Submit a lead]**

> "Watch this. I'll book a free trial as a normal visitor."

**[Browser — booking.html, fill the form, submit]**

> "Form validates client-side. Now in the *other* window —"

**[Cut to /admin.html in another tab]**

> "— a notification just popped in the live feed. The admin dashboard
> received it via Server-Sent Events. Real-time. No polling. No third-party
> service."

> "And in my email — the prospect got a branded HTML confirmation, I
> got the lead notification, and if I'd configured a Slack webhook,
> my phone would have buzzed too."

---

**[1:45 — White-label in 2 files]**

```bash
code config/brand.json config/theme.json
```

> "Want to make this 'Sarah's Yoga Studio' instead of 'Forge'? Two JSON
> files. Change the name, the colours, the address, the social links.
> Restart. Done. The website, the emails, the JSON-LD on every page
> — everything pulls from these."

---

**[2:00 — Production deploy]**

```bash
docker compose up -d --build
```

> "And to ship it — one command. Caddy fetches a Let's Encrypt
> certificate, the Node server starts behind it, the SQLite database
> persists in a Docker volume. You're live on HTTPS."

---

**[2:15 — Outro / CTA]**

> "Forge Academy. Production-ready, white-labelled, $2,000 one-time. Link
> in the description. Fourteen-day money-back, thirty days of support
> included."

> "Build something real."

---

**Recording tips**
- Record terminal at 80×24, 16-pt font, dark theme.
- Browser at 1280×720, hide bookmarks bar.
- Cut between scenes hard — no fades, no zooms.
- Background music: quiet, percussive, royalty-free (Pixabay's "tension"
  category works).
- Add captions — most viewers watch muted on mobile.
