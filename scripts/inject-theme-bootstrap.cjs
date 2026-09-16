#!/usr/bin/env node
/* eslint-disable */
/**
 * Injects the FOUC-prevention theme bootstrap into every HTML page.
 * Idempotent — re-running is safe (skips files that already have the marker).
 *
 * Why an inline <script> in <head>?
 *   The site loads its main JS with `defer`, so theme detection would
 *   otherwise run AFTER first paint and the user would see a flash of
 *   light theme before dark kicks in. The inline snippet runs
 *   synchronously, before the body paints, eliminating the flash.
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = 'forge-theme-bootstrap';
const SNIPPET = `<!-- ${MARKER} -->\n<script>(function(){try{var k='forge:theme';var s=localStorage.getItem(k);var t=s||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0E0F12':'#F7F4EE');}catch(e){}})();</script>\n`;

function listHtmlFiles(dir) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'tests', 'src']);
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.html')) out.push(p);
    }
  }
  walk(dir);
  return out;
}

function inject(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(MARKER)) return { file, status: 'skip' };
  // Anchor on the first <link rel="stylesheet" ...styles.css">
  const linkRe = /<link[^>]*rel=["']stylesheet["'][^>]*styles\.css[^>]*>/i;
  const m = html.match(linkRe);
  if (!m) return { file, status: 'no-anchor' };
  const idx = m.index;
  const updated = html.slice(0, idx) + SNIPPET + html.slice(idx);
  fs.writeFileSync(file, updated, 'utf8');
  return { file, status: 'inject' };
}

const files = listHtmlFiles(ROOT);
const results = files.map(inject);
const grouped = results.reduce((a, r) => ((a[r.status] ||= []).push(r.file), a), {});
console.log('Theme bootstrap injection results:');
for (const k of Object.keys(grouped)) {
  console.log(`  ${k}: ${grouped[k].length}`);
  grouped[k].forEach(f => console.log(`    - ${path.relative(ROOT, f)}`));
}
