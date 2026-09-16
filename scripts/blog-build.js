#!/usr/bin/env node
/* Tiny static blog builder. Reads `content/blog/*.md` (with frontmatter) and
   emits one HTML file per post into `blog/<slug>.html`, plus `blog.html`
   index. Uses the existing site CSS — no extra dependencies.
*/
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT     = '.';
const BLOG_DIR = join(ROOT, 'content', 'blog');
const OUT_DIR  = join(ROOT, 'blog');
mkdirSync(OUT_DIR, { recursive: true });

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i === -1) return;
    let v = line.slice(i + 1).trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    meta[line.slice(0, i).trim()] = v;
  });
  return { meta, body: m[2] };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Minimal Markdown → HTML (headings, bold, italic, links, lists, paragraphs, code)
function md2html(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inUL = false, inOL = false, inCode = false, para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeLists = () => {
    if (inUL) { out.push('</ul>'); inUL = false; }
    if (inOL) { out.push('</ol>'); inOL = false; }
  };
  const inline = (t) => escapeHtml(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const ln of lines) {
    if (ln.startsWith('```')) { flushPara(); closeLists(); if (inCode) { out.push('</code></pre>'); inCode = false; } else { out.push('<pre><code>'); inCode = true; } continue; }
    if (inCode) { out.push(escapeHtml(ln)); continue; }
    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); closeLists(); const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    if (/^\s*-\s+/.test(ln))   { flushPara(); if (inOL) { out.push('</ol>'); inOL=false; } if (!inUL) { out.push('<ul>'); inUL=true; } out.push('<li>' + inline(ln.replace(/^\s*-\s+/,'')) + '</li>'); continue; }
    if (/^\s*\d+\.\s+/.test(ln)){ flushPara(); if (inUL) { out.push('</ul>'); inUL=false; } if (!inOL) { out.push('<ol>'); inOL=true; } out.push('<li>' + inline(ln.replace(/^\s*\d+\.\s+/,'')) + '</li>'); continue; }
    if (!ln.trim()) { flushPara(); closeLists(); continue; }
    para.push(ln);
  }
  flushPara(); closeLists();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

const HEAD = (title, desc, canonical, ogImage = '/og-image.svg') => `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E0F12">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
<link rel="stylesheet" href="../css/styles.css">
</head><body>`;

const HEADER = `
<header class="site-header"><div class="container"><div class="nav-row">
  <a href="../index.html" class="brand"><span class="brand-mark">F</span><span>Forge<span class="brand-sub">Manchester</span></span></a>
  <a href="../index.html" class="btn-forge btn-dark-forge nav-cta">← Home</a>
</div></div></header>`;

const FOOTER = `
<footer class="site-footer" style="padding: 2rem 0;">
  <div class="container d-flex flex-wrap justify-content-between gap-3" style="font-size:.85rem; color: rgba(247,244,238,.55);">
    <span>© 2026 Forge Martial Arts Academy Ltd.</span>
    <span><a href="../index.html">Home</a> · <a href="../schedule.html">Schedule</a> · <a href="../pricing.html">Pricing</a> · <a href="../blog.html">Blog</a></span>
  </div>
</footer></body></html>`;

const BASE_URL = (process.env.PUBLIC_URL || 'https://forgemartialarts.co.uk').replace(/\/$/, '');

if (!existsSync(BLOG_DIR)) {
  console.log(`No content at ${BLOG_DIR} — skipping blog build.`);
  process.exit(0);
}

const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
const posts = [];

for (const f of files) {
  const raw = readFileSync(join(BLOG_DIR, f), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const slug = basename(f, extname(f));
  const stat = statSync(join(BLOG_DIR, f));
  const post = {
    slug,
    title: meta.title || slug,
    summary: meta.summary || '',
    author: meta.author || 'Forge Coaching Team',
    published: meta.published || stat.mtime.toISOString().slice(0, 10),
  };
  posts.push(post);

  const html = md2html(body);
  const canonical = `${BASE_URL}/blog/${slug}.html`;
  const article = `${HEAD(post.title + ' — Forge Manchester', post.summary, canonical)}
${HEADER}
<article class="section section-bone"><div class="container" style="max-width:760px;">
  <span class="eyebrow">Blog · ${escapeHtml(post.published)}</span>
  <h1>${escapeHtml(post.title)}</h1>
  <p class="text-secondary lead">${escapeHtml(post.summary)}</p>
  <hr class="divider">
  <div class="blog-body">${html}</div>
  <hr class="divider">
  <p class="text-secondary"><strong>${escapeHtml(post.author)}</strong> · <a href="../blog.html">← Back to all posts</a></p>
</div></article>
<script type="application/ld+json">${JSON.stringify({
  '@context':'https://schema.org','@type':'BlogPosting',
  headline: post.title, description: post.summary, datePublished: post.published,
  author: { '@type': 'Person', name: post.author },
  publisher: { '@type':'Organization', name:'Forge Martial Arts Academy', url: BASE_URL },
  url: canonical, mainEntityOfPage: canonical
})}</script>
${FOOTER}`;
  writeFileSync(join(OUT_DIR, `${slug}.html`), article);
}

posts.sort((a, b) => b.published.localeCompare(a.published));

const indexBody = posts.map((p) => `
  <article class="feature-card mb-3" style="position:relative;">
    <span class="feature-num">${escapeHtml(p.published.slice(5))}</span>
    <h3><a href="blog/${p.slug}.html" style="color:var(--c-ink);">${escapeHtml(p.title)}</a></h3>
    <p>${escapeHtml(p.summary)}</p>
    <a href="blog/${p.slug}.html" class="text-blood fw-bold">Read post →</a>
  </article>`).join('\n');

const indexHtml = `<!DOCTYPE html><html lang="en-GB"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog — Forge Martial Arts Manchester</title>
<meta name="description" content="Training tips, stories from the mats, and Forge Manchester news.">
<link rel="canonical" href="${BASE_URL}/blog.html">
<meta property="og:title" content="Forge Blog — Manchester"><meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/blog.html"><meta property="og:image" content="${BASE_URL}/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
<link rel="stylesheet" href="css/styles.css">
</head><body>
<header class="site-header"><div class="container"><div class="nav-row">
  <a href="index.html" class="brand"><span class="brand-mark">F</span><span>Forge<span class="brand-sub">Manchester</span></span></a>
  <a href="index.html" class="btn-forge btn-dark-forge nav-cta">← Home</a>
</div></div></header>
<section class="section section-bone"><div class="container" style="max-width:840px;">
  <span class="eyebrow">Blog</span>
  <h1>From The Mats.</h1>
  <p class="lead text-secondary">Training tips, member stories, and Forge Manchester news.</p>
  <hr class="divider">
  ${indexBody || '<p class="text-secondary">No posts yet. Check back soon.</p>'}
</div></section>
<footer class="site-footer" style="padding: 2rem 0;">
  <div class="container d-flex flex-wrap justify-content-between gap-3" style="font-size:.85rem; color: rgba(247,244,238,.55);">
    <span>© 2026 Forge Martial Arts Academy Ltd.</span>
    <span><a href="index.html">Home</a> · <a href="schedule.html">Schedule</a> · <a href="pricing.html">Pricing</a></span>
  </div>
</footer></body></html>`;
writeFileSync('blog.html', indexHtml);

console.log(`✓ Built ${posts.length} blog post(s) → blog/*.html + blog.html index`);
