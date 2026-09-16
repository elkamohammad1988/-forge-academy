/* Replace the old single-line footer on every HTML page with the
   premium 4-column footer. Root pages keep absolute hrefs; pages
   under /programs/ get ../ prefixes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';

const FOOTER = (prefix) => `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">

      <div class="footer-brand">
        <a href="${prefix}index.html" class="footer-brand-row">
          <span class="brand-mark">F</span>
          <span>Forge</span>
        </a>
        <p>
          BJJ · Muay Thai · Boxing · Kids Karate · Strength &amp; Conditioning.
        </p>
        <div class="footer-social" aria-label="Follow us">
          <a href="https://www.instagram.com/forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
          <a href="https://www.facebook.com/forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg>
          </a>
          <a href="https://www.youtube.com/@forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
          </a>
          <a href="https://www.tiktok.com/@forgemartialarts" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 6.7a5.5 5.5 0 0 1-3.3-1.1 5.5 5.5 0 0 1-2-3.6h-3v13.6a2.6 2.6 0 1 1-1.8-2.5V9.9a5.7 5.7 0 1 0 4.7 5.6V9.4a8.4 8.4 0 0 0 5.4 1.9V8.2a5.4 5.4 0 0 1-.0-1.5z"/></svg>
          </a>
        </div>
      </div>

      <div class="footer-col">
        <h4>Explore</h4>
        <ul>
          <li><a href="${prefix}index.html#why">Why Forge</a></li>
          <li><a href="${prefix}schedule.html">Schedule</a></li>
          <li><a href="${prefix}pricing.html">Pricing</a></li>
          <li><a href="${prefix}coaches.html">Coaches</a></li>
          <li><a href="${prefix}reviews.html">Reviews</a></li>
          <li><a href="${prefix}events.html">Events</a></li>
          <li><a href="${prefix}account.html">Member Portal</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Programs</h4>
        <ul>
          <li><a href="${prefix}programs/bjj.html">Brazilian Jiu-Jitsu</a></li>
          <li><a href="${prefix}programs/muay-thai.html">Muay Thai</a></li>
          <li><a href="${prefix}programs/boxing.html">Boxing</a></li>
          <li><a href="${prefix}programs/kids.html">Kids Karate</a></li>
          <li><a href="${prefix}index.html#first-class">First Class Playbook</a></li>
          <li><a href="${prefix}index.html#forge-path">The Forge Path</a></li>
        </ul>
      </div>

      <div class="footer-col footer-newsletter">
        <h4>Newsletter</h4>
        <p>Monthly drills, fight nights and member offers — straight to your inbox. No spam, ever.</p>
        <form class="footer-newsletter-form" data-forge-form data-form-id="newsletter" data-redirect="${prefix}thank-you.html" novalidate>
          <input type="email" name="email" placeholder="you@example.com" required aria-label="Email address">
          <button type="submit">Subscribe</button>
        </form>
        <p class="footer-newsletter-fineprint">Drop us a line: <a href="mailto:hello@forgemartialarts.co.uk" style="color: var(--c-gold);">hello@forgemartialarts.co.uk</a> · <a href="tel:+441612000000" style="color: var(--c-gold);">0161 200 0000</a></p>
      </div>

    </div>

    <div class="row g-4 align-items-center" style="border-top: 1px solid rgba(247,244,238,.08); padding-top: 2rem;">
      <div class="col-md-4">
        <h4 style="color: var(--c-bone); font-family: var(--f-body); font-weight: 800; font-size: .8rem; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 .6rem;">Visit</h4>
        <p style="color: rgba(247,244,238,.7); margin: 0; font-size: .92rem; line-height: 1.55;">
          Unit 4, Dale Street<br>
          Manchester M1 1JW · United Kingdom
        </p>
      </div>
      <div class="col-md-4">
        <h4 style="color: var(--c-bone); font-family: var(--f-body); font-weight: 800; font-size: .8rem; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 .6rem;">Hours</h4>
        <p style="color: rgba(247,244,238,.7); margin: 0; font-size: .92rem; line-height: 1.55;">
          Mon–Fri: 6:00am – 9:30pm · Sat: 9–4 · Sun: 10–1
        </p>
      </div>
      <div class="col-md-4 text-md-end">
        <a class="mcr-badge" href="${prefix}contact.html#map" aria-label="Find us in Manchester">
          <svg class="bee-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2c1.4 0 2.6.9 3 2.2-.4.2-.7.5-1 .8H10c-.3-.3-.6-.6-1-.8C9.4 2.9 10.6 2 12 2zm-3.5 4h7c.8 0 1.5.4 2 1l1.7-1c.5-.3 1.1.4.7.8l-1.5 1.4c.4.5.6 1.1.6 1.8 0 .3-.1.7-.2 1l1.6.8c.5.3.2 1-.3.9l-1.9-.4c-.3.5-.7.9-1.2 1.2l.5 1.7c.1.5-.5.9-.8.5l-1.2-1.4c-.6.3-1.3.4-2 .4h-3c-.7 0-1.4-.1-2-.4l-1.2 1.4c-.3.4-.9 0-.8-.5l.5-1.7c-.5-.3-.9-.7-1.2-1.2l-1.9.4c-.5.1-.8-.6-.3-.9l1.6-.8c-.1-.3-.2-.7-.2-1 0-.7.2-1.3.6-1.8L4.1 6.8C3.7 6.4 4.3 5.7 4.8 6l1.7 1c.5-.6 1.2-1 2-1zm.5 4v2h6v-2H9zm0 3v2h6v-2H9zm3 5c-1 0-2 .8-2 1.8 0 1.2 1.7 2.2 2 2.2.3 0 2-1 2-2.2 0-1-1-1.8-2-1.8z"/>
          </svg>
          Mancunian since 2014
        </a>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2026 Forge Martial Arts Academy Ltd. All rights reserved.</span>
      <div class="footer-bottom-legal">
        <a href="#" data-open-modal="modalPrivacy">Privacy</a>
        <a href="#" data-open-modal="modalTerms">Terms</a>
        <a href="#" data-open-modal="modalCookies">Cookies</a>
        <a href="#" data-cookie-reopen>Cookie Settings</a>
        <a href="#" data-lang="en">EN</a>
        <a href="#" data-lang="ar">ع</a>
      </div>
    </div>
  </div>
</footer>`;

const TARGETS = [
  { file: '404.html',                 prefix: '' },
  { file: 'account.html',             prefix: '' },
  { file: 'booking.html',             prefix: '' },
  { file: 'class.html',               prefix: '' },
  { file: 'coaches.html',             prefix: '' },
  { file: 'contact.html',             prefix: '' },
  { file: 'events.html',              prefix: '' },
  { file: 'gallery.html',             prefix: '' },
  { file: 'pricing.html',             prefix: '' },
  { file: 'reviews.html',             prefix: '' },
  { file: 'schedule.html',            prefix: '' },
  { file: 'thank-you.html',           prefix: '' },
  { file: 'programs/bjj.html',        prefix: '../' },
  { file: 'programs/boxing.html',     prefix: '../' },
  { file: 'programs/kids.html',       prefix: '../' },
  { file: 'programs/muay-thai.html',  prefix: '../' }
];

// Match the OLD inline footer regardless of attribute order/whitespace.
const OLD_FOOTER_RE = /<footer\s+class="site-footer"[^>]*>[\s\S]*?<\/footer>/;

let updated = 0;
for (const { file, prefix } of TARGETS) {
  let html;
  try { html = readFileSync(file, 'utf8'); }
  catch { console.warn(`× missing ${file}`); continue; }

  if (!OLD_FOOTER_RE.test(html)) {
    console.warn(`- no footer match in ${file}`);
    continue;
  }
  const next = html.replace(OLD_FOOTER_RE, FOOTER(prefix));
  writeFileSync(file, next);
  updated++;
  console.log(`✓ updated ${file}`);
}
console.log(`\nDone. Updated ${updated}/${TARGETS.length} footers.`);
