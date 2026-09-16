# Screenshots checklist

What to capture before listing the product. Aim for **8–10 hero shots**.
Run `npm run demo` first so the data looks real.

## Browser setup

- 1280×800 viewport (looks crisp on retail listing pages).
- Light Bootstrap-style theme assumed; if you've recoloured, capture both.
- Hide bookmarks bar, extensions, Cloud sync icons.
- Use the Forge "Manchester" branding in the demo seed — buyers will
  visualise their own branding by analogy.

## Required shots

1. **Homepage hero** — full viewport, hero + sticky nav + next-class
   banner visible. The single most important screenshot.
2. **Schedule page** — filters at the top, at least 2 days of classes
   visible, a Book button highlighted on hover.
3. **Pricing page** — three tiers, the "Recommended" badge prominent,
   monthly/annual toggle visible.
4. **Booking form** — populated halfway through, validation visible on
   one field for that "real form" feel.
5. **Thank-you page** — the calendar download button, refer-a-friend
   block expanded.
6. **Member dashboard** — at least 2 upcoming bookings, plan label
   showing, verify-email banner *off* (fake the timestamp in seed).
7. **Admin dashboard** — KPIs lit up, 30-day chart with the sample
   sparkline, leads table with multiple statuses, **a live-feed toast
   visible in the bottom-right** (record then screen-grab right after
   submitting a lead).
8. **Admin → newsletter broadcast tab** — demonstrates the owner-power
   features.
9. **Email** — open the dev-stdout email or a real inbox; capture the
   branded HTML lead-confirmation. Crop to phone aspect ratio (390×844)
   — emails are read on phones.
10. **Mobile** — DevTools at 390×844, homepage with the mobile call-bar
    visible at the bottom. Optional: schedule page on mobile.

## Optional but high-value

- **Lighthouse panel** — homepage. Publish only the scores you actually measure.
- **securityheaders.com** scan — whatever grade it actually returns.
- **OpenAPI** — `/api/openapi.json` rendered in Swagger UI / Stoplight.
- **Stripe Checkout** — a card-input page with the gym branding pulled
  through.
- **Slack notification** — a real Slack message of "🥋 New lead at Forge".

## Layout

For a Gumroad / LemonSqueezy gallery:
- Hero (#1) and admin (#7) as the first two.
- Mobile (#10) third — buyers worry about mobile.
- Then the rest in feature order.

For social / Twitter:
- Carousel of 3: hero, admin live feed, mobile.
- One quote-card image with the price ("$2,000 one-time. Yours forever.")

## File names (so you don't have to re-figure this out next time)

```
marketing/screenshots/
  01-home-hero.png
  02-schedule.png
  03-pricing.png
  04-booking-form.png
  05-thankyou.png
  06-member-dashboard.png
  07-admin-live-feed.png
  08-admin-newsletter.png
  09-email-html.png
  10-mobile-home.png
  bonus-lighthouse.png
  bonus-securityheaders.png
```
