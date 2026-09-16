import { Router } from 'express';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(dirname(__filename))); // …/forge-academy
const BLOG_DIR = join(ROOT, 'content', 'blog');

const router = Router();

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    meta[k] = v;
  });
  return { meta, body: m[2] };
}

function readPosts() {
  if (!existsSync(BLOG_DIR)) return [];
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  return files.map((f) => {
    const raw = readFileSync(join(BLOG_DIR, f), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = basename(f, extname(f));
    const stat = statSync(join(BLOG_DIR, f));
    return {
      slug,
      title: meta.title || slug,
      summary: meta.summary || '',
      author: meta.author || 'Forge Coaching Team',
      published: meta.published || stat.mtime.toISOString().slice(0, 10),
      tags: (meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      body,
    };
  }).sort((a, b) => b.published.localeCompare(a.published));
}

router.get('/', (_req, res) => {
  const posts = readPosts().map(({ body, ...rest }) => rest);
  res.json({ ok: true, posts });
});

router.get('/:slug', (req, res) => {
  const slug = String(req.params.slug || '').replace(/[^a-z0-9-]/gi, '');
  const all = readPosts();
  const post = all.find((p) => p.slug === slug);
  if (!post) return res.status(404).json({ ok: false, error: 'Not found.' });
  res.json({ ok: true, post });
});

export default router;
