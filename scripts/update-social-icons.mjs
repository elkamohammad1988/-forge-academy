/* Replace the footer social icons across every page with refined,
   stroke-consistent outlined SVGs. Eliminates the visual-weight
   mismatch between filled (FB / YT / TikTok) and outlined (IG) icons. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOCIAL_BLOCK = `<div class="footer-social" aria-label="Follow us">
          <a href="https://www.instagram.com/forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.55" fill="currentColor" stroke="none"/></svg>
          </a>
          <a href="https://www.facebook.com/forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
          <a href="https://www.youtube.com/@forgemartialartsmanchester" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
          </a>
          <a href="https://www.tiktok.com/@forgemartialarts" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
          </a>
        </div>`;

// Old block matches whether the formatter expanded the class attribute or not.
const OLD_RE = /<div\s+class="\s*footer-social\s*"[\s\S]*?<\/div>/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === '.vercel' || name === 'screenshots') continue;
      out.push(...walk(full));
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk('.');
let updated = 0;

for (const f of files) {
  let html = readFileSync(f, 'utf8');
  if (!OLD_RE.test(html)) continue;
  const next = html.replace(OLD_RE, SOCIAL_BLOCK);
  if (next !== html) {
    writeFileSync(f, next);
    updated++;
    console.log('✓ ' + f);
  }
}
console.log(`\nDone. Updated ${updated} files.`);
