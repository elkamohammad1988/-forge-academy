#!/usr/bin/env node
/* Apply config/brand.json + config/theme.json across the codebase.

   This makes the marketing promise true: "white-label in two JSON files".
   The script does well-anchored string replacements across all HTML files,
   regenerates CSS variables from the theme palette, and rewrites the
   webmanifest + sitemap with the new domain.

   Idempotent: re-running with the same JSON values is a no-op. The script
   keeps a snapshot of "what was last applied" in `.brand-applied.json` so
   you can change brand.json over time without surprises.

   Usage:
     node scripts/brand-apply.js              # apply current config
     node scripts/brand-apply.js --dry-run    # show what would change
     node scripts/brand-apply.js --revert     # roll back to the last snapshot
*/
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '.';
const SNAPSHOT = '.brand-applied.json';
const argv = new Set(process.argv.slice(2));
const DRY = argv.has('--dry-run');
const REVERT = argv.has('--revert');

function load(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

const brand = load('config/brand.json');
const theme = load('config/theme.json');
const previous = existsSync(SNAPSHOT) ? load(SNAPSHOT) : null;

if (REVERT) {
  if (!previous) { console.error('No snapshot found at', SNAPSHOT); process.exit(1); }
  applyReplacements(buildReplacements(previous, brand), { reverse: true });
  console.log('✓ Reverted to previous snapshot.');
  process.exit(0);
}

// ─── Replacement table ─────────────────────────────────────────────────────
// `from` is the string currently in the codebase; `to` is the new brand value.
// Order matters — long, specific strings first.
function buildReplacements(from, to) {
  return [
    // Email
    { from: from.email,                  to: to.email },
    // Domain (with and without protocol)
    { from: from.url,                    to: to.url },
    { from: from.url.replace(/^https?:\/\//, ''), to: to.url.replace(/^https?:\/\//, '') },
    // Phone
    { from: from.phoneTel,               to: to.phoneTel },
    { from: from.phoneDisplay,           to: to.phoneDisplay },
    // Address
    { from: from.address.street,         to: to.address.street },
    { from: from.address.postcode,       to: to.address.postcode },
    // Names — long form first, then short
    { from: from.name,                   to: to.name },
    { from: from.tagline,                to: to.tagline },
    // City / established date
    { from: 'Manchester · Est. ' + from.established, to: to.address.city + ' · Est. ' + to.established },
    // Stats (only if values changed)
    { from: from.stats.members + ' Active Members',  to: to.stats.members + ' Active Members' },
    { from: from.stats.coaches + ' Certified Coaches', to: to.stats.coaches + ' Certified Coaches' },
    { from: from.stats.rating  + ' Google Rating',   to: to.stats.rating  + ' Google Rating' },
    { from: from.stats.yearsOpen + ' Years In ' + from.address.city, to: to.stats.yearsOpen + ' Years In ' + to.address.city },
    { from: 'Rated ' + from.stats.rating.replace('★', '') + ' by ' + from.stats.reviews + '+ ' + from.address.city + ' locals',
      to:   'Rated ' + to.stats.rating.replace('★', '')   + ' by ' + to.stats.reviews   + '+ ' + to.address.city   + ' locals' },
    { from: from.stats.rating + ' Rated by ' + from.stats.reviews + '+ Mancunians',
      to:   to.stats.rating   + ' Rated by ' + to.stats.reviews   + '+ ' + to.address.city },
    // Legal company name
    { from: from.legal?.company,         to: to.legal?.company },
  ].filter((r) => r.from && r.to && r.from !== r.to);
}

function listHtml() {
  const out = [];
  function walk(dir) {
    for (const f of readdirSync(dir)) {
      if (f.startsWith('.') || f === 'node_modules' || f === 'dist' || f === 'data' || f === 'coverage') continue;
      const p = join(dir, f);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (/\.(html|webmanifest|xml|md)$/.test(f)) out.push(p);
    }
  }
  walk(ROOT);
  return out;
}

function applyReplacements(reps, { reverse = false } = {}) {
  const files = listHtml();
  let touched = 0;
  for (const file of files) {
    const before = readFileSync(file, 'utf8');
    let after = before;
    for (const r of reps) {
      const find = reverse ? r.to : r.from;
      const repl = reverse ? r.from : r.to;
      if (!find) continue;
      after = after.split(find).join(repl);
    }
    if (after !== before) {
      touched++;
      console.log(`  ${DRY ? '[dry] ' : ''}${file}`);
      if (!DRY) writeFileSync(file, after);
    }
  }
  return touched;
}

// ─── CSS theme tokens ──────────────────────────────────────────────────────
function applyTheme() {
  const cssPath = join(ROOT, 'css', 'styles.css');
  if (!existsSync(cssPath)) return false;
  let css = readFileSync(cssPath, 'utf8');
  const map = {
    '--c-ink':       theme.colors.ink,
    '--c-ink-soft':  theme.colors.inkSoft,
    '--c-charcoal':  theme.colors.charcoal,
    '--c-bone':      theme.colors.bone,
    '--c-paper':     theme.colors.paper,
    '--c-mute':      theme.colors.mute,
    '--c-line':      theme.colors.line,
    '--c-blood':     theme.colors.blood,
    '--c-blood-dk':  theme.colors.bloodDark,
    '--c-gold':      theme.colors.gold,
    '--c-gold-soft': theme.colors.goldSoft,
    // Mancunian accents
    '--c-sky':       theme.colors.sky,
    '--c-sky-dk':    theme.colors.skyDark,
    '--c-bee':       theme.colors.bee,
    '--c-brick':     theme.colors.brick,
  };
  let changed = false;
  for (const [name, value] of Object.entries(map)) {
    if (!value) continue;
    const re = new RegExp(`(${escapeRe(name)}:\\s*)([^;]+)(;)`);
    const m = css.match(re);
    if (m && m[2].trim() !== value) {
      css = css.replace(re, `$1${value}$3`);
      changed = true;
    }
  }
  if (changed && !DRY) writeFileSync(cssPath, css);
  if (changed) console.log(`  ${DRY ? '[dry] ' : ''}css/styles.css (palette updated)`);
  return changed;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ─── Run ────────────────────────────────────────────────────────────────────
const baseline = previous || brand;
const reps = buildReplacements(baseline, brand);

if (!reps.length && JSON.stringify(theme) === JSON.stringify(previous?.__theme || theme)) {
  console.log('Nothing to do — brand.json + theme.json already applied.');
  process.exit(0);
}

console.log(`${DRY ? '[dry-run] ' : ''}Applying ${reps.length} string replacement(s)…`);
const filesTouched = applyReplacements(reps);
console.log(`${DRY ? '[dry-run] ' : ''}Updating CSS palette…`);
applyTheme();

if (!DRY) {
  writeFileSync(SNAPSHOT, JSON.stringify({ ...brand, __theme: theme }, null, 2));
  console.log(`✓ ${filesTouched} file(s) updated. Snapshot saved to ${SNAPSHOT}.`);
  console.log('  Verify with: git diff');
} else {
  console.log(`(dry run — no files written; ${filesTouched} would change)`);
}
