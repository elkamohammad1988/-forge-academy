/* Capture professional portfolio screenshots of the deployed site.
   Outputs to ./screenshots/ — desktop + mobile + section close-ups. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SHOT_BASE || 'http://localhost:3000';
const OUT  = resolve('./screenshots');
mkdirSync(OUT, { recursive: true });

// 2x is crisp but the full-page shots get very large; SHOT_SCALE=1 keeps the
// portfolio set web-sized.
const SCALE = Number(process.env.SHOT_SCALE || 2);
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: SCALE };
const MOBILE  = { width:  390, height: 844, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true };

const PAGES = [
  { name: '01-home',                 path: '/',                       desktop: 'full' },
  { name: '02-home-hero',            path: '/',                       desktop: 'viewport' },
  { name: '03-pricing',              path: '/pricing.html',           desktop: 'full' },
  { name: '04-coaches',              path: '/coaches.html',           desktop: 'full' },
  { name: '05-reviews',              path: '/reviews.html',           desktop: 'full' },
  { name: '06-schedule',             path: '/schedule.html',          desktop: 'full' },
  { name: '07-booking',              path: '/booking.html',           desktop: 'full' },
  { name: '08-bjj',                  path: '/programs/bjj.html',      desktop: 'full' },
  { name: '09-mobile-home',          path: '/',                       mobile:  'full' },
  { name: '10-mobile-pricing',       path: '/pricing.html',           mobile:  'full' },
  { name: '11-muay-thai',            path: '/programs/muay-thai.html', desktop: 'full' },
  { name: '12-boxing',               path: '/programs/boxing.html',   desktop: 'full' },
  { name: '13-kids',                 path: '/programs/kids.html',     desktop: 'full' }
];

async function shoot(browser, viewport, isMobile, page, mode) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: !!isMobile,
    hasTouch: !!isMobile,
    reducedMotion: 'no-preference',
    colorScheme: 'light'
  });
  const tab = await ctx.newPage();
  const url = BASE + page.path;
  // Prefer a fully settled page, but pages with third-party embeds (maps,
  // remote imagery) may never reach networkidle — fall back rather than fail.
  try {
    await tab.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch {
    await tab.goto(url, { waitUntil: 'load', timeout: 25000 });
    await tab.waitForTimeout(1500);
  }

  // Hide cookie banners / drawers if any
  await tab.addStyleTag({ content: `
    .cookie-banner, .toast-stack { display: none !important; }
    [data-cookie-banner] { display: none !important; }
  `});

  // Allow CSS animations to "settle" — pause marquee on a known frame
  await tab.evaluate(() => {
    document.querySelectorAll('.marquee-track').forEach(el => {
      el.style.animationDelay = '-12s';
    });
  });
  await tab.waitForTimeout(800);

  const file = `${OUT.replaceAll('\\','/')}/${page.name}${isMobile ? '-m' : ''}.png`;
  await tab.screenshot({
    path: file,
    fullPage: mode === 'full',
    animations: 'disabled'
  });
  await ctx.close();
  return file;
}

// Prefer Playwright's bundled Chromium; fall back to an installed Chrome so
// this works without `npx playwright install`. Override with SHOT_CHANNEL.
const channel = process.env.SHOT_CHANNEL;
const browser = await chromium.launch(channel ? { channel } : {}).catch(async (err) => {
  if (channel) throw err;
  console.warn('• Bundled Chromium unavailable — falling back to system Chrome.');
  return chromium.launch({ channel: 'chrome' });
});

for (const p of PAGES) {
  if (p.desktop) {
    const f = await shoot(browser, DESKTOP, false, p, p.desktop);
    console.log(`✓ ${f}`);
  }
  if (p.mobile) {
    const f = await shoot(browser, MOBILE, true, p, p.mobile);
    console.log(`✓ ${f}`);
  }
}

await browser.close();
console.log('\nAll screenshots saved to', OUT);
