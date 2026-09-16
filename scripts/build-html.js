/* Production HTML build:
   - rewrites <script src="js/app.js"> to dist/js/app.js (already minified)
   - copies HTML files into dist/
   - copies static assets (manifest, sw, sitemap, robots, og-image, favicon-equivalents)
*/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = '.';
const OUT  = './dist';

mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'css'), { recursive: true });
mkdirSync(join(OUT, 'js'),  { recursive: true });

const HTML_FILES = readdirSync(ROOT).filter((f) => f.endsWith('.html'));

for (const file of HTML_FILES) {
  let html = readFileSync(join(ROOT, file), 'utf8');
  html = html.replace(/href="css\/styles\.css"/g, 'href="css/styles.css"');
  html = html.replace(/src="js\/(app|api)\.js"/g, 'src="js/$1.js"');
  writeFileSync(join(OUT, file), html);
}

// Copy static
['manifest.webmanifest', 'sw.js', 'sitemap.xml', 'robots.txt', 'og-image.svg', '_headers', '.htaccess']
  .forEach((f) => {
    try { copyFileSync(join(ROOT, f), join(OUT, f)); } catch {}
  });

// eslint-disable-next-line no-console
console.log(`✓ Built ${HTML_FILES.length} HTML files into ${OUT}/`);
