#!/usr/bin/env node
/* Make this yours.
 *
 * One command takes the repo from "Forge demo" to "your gym, live":
 *   1. Asks for the gym's real details (name, contact, address, social)
 *   2. Writes config/brand.json
 *   3. Disables demoMedia in features.json (your uploads now drive every photo)
 *   4. Runs brand:apply — every HTML page, every email, every JSON-LD
 *      flips from "Forge Martial Arts Academy" to your gym name
 *   5. Cleans demo rows from the database
 *   6. Generates a fresh JWT_SECRET if one isn't set
 *   7. Updates .env with your public URL + owner email
 *   8. Creates your first admin account
 *   9. Tells you exactly what's next
 *
 * Re-runnable. Brand snapshot lives in `.brand-applied.json` so re-running
 * with edits diffs cleanly; `npm run brand:revert` rolls back.
 *
 * Usage:  npm run go-live
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, def) => {
  const prompt = def ? `${q} [${def}]: ` : `${q}: `;
  const ans = (await rl.question(prompt)).trim();
  return ans || def || '';
};
const askRequired = async (q, def) => {
  let v = '';
  while (!v) {
    v = await ask(q, def);
    if (!v) console.log('  required.');
  }
  return v;
};

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Make this site yours');
console.log('═══════════════════════════════════════════════════════════\n');
console.log("Answer a handful of questions — this rewrites the brand,");
console.log("propagates it everywhere, wipes demo data and creates");
console.log("your first admin. ~3 minutes.\n");

// ─── 1. Read current brand to preserve any non-asked fields ───────────────
let current = {};
try { current = JSON.parse(readFileSync('config/brand.json', 'utf8')); } catch {}

// ─── 2. Prompts ──────────────────────────────────────────────────────────
console.log('— Brand —');
const name        = await askRequired('Gym name (full, e.g. "Iron & Bone Academy")', current.name);
const shortName   = await ask         ('Short name (1 word, used in emails)', current.shortName || name.split(/\s+/)[0]);
const tagline     = await ask         ('Tagline', current.tagline || 'Step On The Mat.');
const established = await ask         ('Year established', current.established || '2018');
const url         = await askRequired ('Public URL (https://...)', current.url);
const email       = await askRequired ('Contact email', current.email);
const phoneTel    = await askRequired ('Phone (international, e.g. +441612000000)', current.phoneTel);
const phoneDisplay= await ask         ('Phone (how it should display)', current.phoneDisplay || phoneTel);

console.log('\n— Address —');
const street      = await askRequired ('Street', current.address?.street);
const city        = await askRequired ('City', current.address?.city || current.city);
const postcode    = await ask         ('Postcode', current.address?.postcode || '');
const country     = await ask         ('Country code (2 letters)', current.address?.country || 'GB');

console.log('\n— Social (leave blank to skip) —');
const instagram   = await ask('Instagram URL', current.social?.instagram || '');
const facebook    = await ask('Facebook URL',  current.social?.facebook  || '');
const tiktok      = await ask('TikTok URL',    current.social?.tiktok    || '');

console.log('\n— Business statistics (leave blank unless you can evidence them) —');
const members     = await ask('Members count display',  current.stats?.members   || '');
const coaches     = await ask('Coach count',            current.stats?.coaches   || '');
const rating      = await ask('Star rating',            current.stats?.rating    || '');
const reviews     = await ask('Number of reviews',      current.stats?.reviews   || '');
const yearsOpen   = await ask('Years-open display',     current.stats?.yearsOpen || '');

console.log('\n— Legal —');
const company     = await ask('Legal company name', current.legal?.company || `${name} Ltd`);

// ─── 3. Write brand.json ─────────────────────────────────────────────────
const brand = {
  name, shortName, tagline, city, established,
  url, email, phoneDisplay, phoneTel,
  whatsapp: current.whatsapp || phoneTel,
  address: { street, city, postcode, country, lat: 53.482, lng: -2.230 },
  hours: current.hours || [
    { day: 1, open: '06:00', close: '21:30', label: 'Mon' },
    { day: 2, open: '06:00', close: '21:30', label: 'Tue' },
    { day: 3, open: '06:00', close: '21:30', label: 'Wed' },
    { day: 4, open: '06:00', close: '21:30', label: 'Thu' },
    { day: 5, open: '06:00', close: '21:30', label: 'Fri' },
    { day: 6, open: '09:00', close: '16:00', label: 'Sat' },
    { day: 0, open: '10:00', close: '13:00', label: 'Sun' },
  ],
  social: { instagram, facebook, youtube: current.social?.youtube || '', tiktok },
  stats:  { members, coaches, rating, reviews, yearsOpen },
  legal:  { company, vatNumber: current.legal?.vatNumber || '', registered: current.legal?.registered || '' },
};
writeFileSync('config/brand.json', JSON.stringify(brand, null, 2) + '\n');
console.log('\n✓ config/brand.json written');

// ─── 4. Disable demoMedia (real uploads only from here) ──────────────────
try {
  const features = JSON.parse(readFileSync('config/features.json', 'utf8'));
  features.demoMedia = false;
  writeFileSync('config/features.json', JSON.stringify(features, null, 2) + '\n');
  console.log('✓ demoMedia disabled — your uploads now drive every photo');
} catch (e) {
  console.warn('⚠ could not update config/features.json:', e.message);
}

// ─── 5. Brand-apply ──────────────────────────────────────────────────────
console.log('\n— Propagating brand across HTML / CSS / sitemap —');
execSync('node scripts/brand-apply.js', { stdio: 'inherit' });

// ─── 6. Wipe demo rows ───────────────────────────────────────────────────
console.log('\n— Cleaning demo data —');
const { getDb, closeDb, initDb } = await import('../src/db.js');
initDb();
const db = getDb();
const before = {
  members:    db.prepare('SELECT COUNT(*) AS c FROM members').get().c,
  leads:      db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
  newsletter: db.prepare('SELECT COUNT(*) AS c FROM newsletter').get().c,
  contacts:   db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c,
};
db.transaction(() => {
  db.exec(`
    DELETE FROM members    WHERE email LIKE 'demo+%' OR email LIKE '%@demo.test' OR email LIKE '%@example.test';
    DELETE FROM newsletter WHERE email LIKE 'demo+%' OR email LIKE '%@example.test';
    DELETE FROM leads      WHERE email LIKE 'demo+%' OR email LIKE '%@example.test';
    DELETE FROM contacts   WHERE email LIKE 'demo+%' OR email LIKE '%@example.test';
    DELETE FROM lead_notes  WHERE lead_id  NOT IN (SELECT id FROM leads);
    DELETE FROM bookings    WHERE member_id NOT IN (SELECT id FROM members);
    DELETE FROM achievements WHERE member_id NOT IN (SELECT id FROM members);
    DELETE FROM auth_tokens   WHERE member_id NOT IN (SELECT id FROM members);
    DELETE FROM push_subscriptions WHERE member_id NOT IN (SELECT id FROM members);
    DELETE FROM member_credits WHERE member_id NOT IN (SELECT id FROM members);
    DELETE FROM referrals    WHERE referrer_id NOT IN (SELECT id FROM members);
    DELETE FROM email_queue  WHERE source LIKE 'trial:%' AND to_email LIKE '%@example.test';
  `);
})();
const after = {
  members:    db.prepare('SELECT COUNT(*) AS c FROM members').get().c,
  leads:      db.prepare('SELECT COUNT(*) AS c FROM leads').get().c,
  newsletter: db.prepare('SELECT COUNT(*) AS c FROM newsletter').get().c,
  contacts:   db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c,
};
console.log(
  `✓ removed: ${before.members - after.members} members, ` +
  `${before.leads - after.leads} leads, ` +
  `${before.newsletter - after.newsletter} newsletter, ` +
  `${before.contacts - after.contacts} contacts`
);
closeDb();

// ─── 7. .env ─────────────────────────────────────────────────────────────
console.log('\n— .env —');
let envText = existsSync('.env') ? readFileSync('.env', 'utf8') : readFileSync('.env.example', 'utf8');

const setOrInsert = (key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(envText)) envText = envText.replace(re, `${key}=${value}`);
  else envText += `\n${key}=${value}`;
};

if (/JWT_SECRET=replace-me|JWT_SECRET=$|JWT_SECRET=\s*$/.test(envText) || !/^JWT_SECRET=.{40}/m.test(envText)) {
  const secret = randomBytes(48).toString('base64url');
  setOrInsert('JWT_SECRET', secret);
  console.log('✓ generated a fresh JWT_SECRET');
}
setOrInsert('PUBLIC_URL', url);
setOrInsert('ALLOWED_ORIGINS', url);
setOrInsert('EMAIL_TO_OWNER', email);
setOrInsert('EMAIL_FROM', `"${name} <${email}>"`);
setOrInsert('NODE_ENV', envText.includes('NODE_ENV=production') ? 'production' : 'production');
writeFileSync('.env', envText);
console.log('✓ .env updated with your URL + owner email');

// ─── 8. Admin account ────────────────────────────────────────────────────
console.log('\n— First admin —');
const adminEmail = await ask('Admin email', email);
const adminPw    = await ask('Admin password (min 8 chars; you can change later)');
if (adminPw && adminPw.length >= 8) {
  try {
    execSync(`node scripts/create-admin.js "${adminEmail}" "${adminPw.replace(/"/g, '\\"')}" "${shortName}"`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠ admin creation failed — run later: node scripts/create-admin.js <email> <password>');
  }
} else {
  console.log('⚠ skipped — run later: node scripts/create-admin.js <email> <password>');
}

// ─── 9. Done ─────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  ${name} — ready to go.`);
console.log('═══════════════════════════════════════════════════════════');
console.log('  Run:                  npm run dev');
console.log(`  Open:                 ${url}`);
console.log(`  Sign in:              ${url}/admin.html`);
console.log('  Upload first photos:  /admin.html → Gallery / Coaches');
console.log('  Configure Stripe:     DEPLOY_CHECKLIST.md → §3');
console.log('  Day-1 smoke test:     DEPLOY_CHECKLIST.md → §11');
console.log('  Roll back any time:   npm run brand:revert');
console.log('═══════════════════════════════════════════════════════════\n');

rl.close();
