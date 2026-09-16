/* Image / file uploads. Admin-gated POST, public read.
   Uses multer for multipart parsing, files stored on local disk under
   the storage abstraction so it can be swapped for S3 later.
*/
import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { getDb, audit } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { ensureDir, fsRoot, publicUrlFor, isAllowedMime, isVideoMime, maxBytesFor, safeName, extFor } from '../lib/storage.js';

const router = Router();

const KINDS = new Set(['gallery', 'coach', 'blog', 'video', 'misc']);

// Video uploads can be much bigger than images. Pick the size cap per-kind.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const kind = KINDS.has(req.params.kind) ? req.params.kind : 'misc';
      cb(null, ensureDir(kind));
    },
    filename: (_req, file, cb) => {
      const ext = extFor(file.mimetype);
      cb(null, Date.now() + '-' + safeName(file.originalname).replace(/\.[^.]*$/, '') + ext);
    },
  }),
  limits: {
    // Multer applies a single limit; pick the larger one and validate per-kind below
    fileSize: Math.max(maxBytesFor('image'), maxBytesFor('video')),
  },
  fileFilter: (req, file, cb) => {
    const kind = req.params.kind;
    if (!isAllowedMime(file.mimetype))             return cb(new Error('Unsupported file type: ' + file.mimetype));
    if (kind === 'video' && !isVideoMime(file.mimetype)) return cb(new Error('This kind only accepts videos.'));
    if (kind !== 'video' && isVideoMime(file.mimetype))  return cb(new Error('Use kind=video for video files.'));
    cb(null, true);
  },
});

// Public: list active uploads of a given kind (no auth required for gallery)
router.get('/:kind', (req, res) => {
  const kind = req.params.kind;
  if (!KINDS.has(kind)) return res.status(404).json({ ok: false });
  const rows = getDb().prepare(`
    SELECT id, filename, path, mime, caption, width, height, related_id, position, created_at
    FROM uploads WHERE kind = ? AND active = 1
    ORDER BY position ASC, id DESC LIMIT 200
  `).all(kind);
  res.json({ ok: true, uploads: rows.map((r) => ({ ...r, url: publicUrlFor(r.path) })) });
});

// Admin: upload a file
router.post('/:kind', requireAdmin, upload.single('file'), (req, res) => {
  const kind = KINDS.has(req.params.kind) ? req.params.kind : 'misc';
  if (!req.file) return res.status(422).json({ ok: false, error: 'No file received.' });
  // Per-kind size cap (multer accepts up to the larger limit)
  if (req.file.size > maxBytesFor(kind === 'video' ? 'video' : 'image')) {
    try { unlinkSync(req.file.path); } catch {}
    return res.status(413).json({ ok: false, error: 'File too large for this kind.' });
  }
  const relPath = join(kind, req.file.filename).replace(/\\/g, '/');

  const captionSchema = z.object({
    caption: z.string().max(300).optional().or(z.literal('')),
    related_id: z.coerce.number().int().optional(),
    position:   z.coerce.number().int().min(0).max(9999).optional(),
  });
  const meta = captionSchema.safeParse(req.body).success ? req.body : {};

  const r = getDb().prepare(`
    INSERT INTO uploads (filename, mime, size_bytes, path, kind, related_id, caption, position, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.file.originalname, req.file.mimetype, req.file.size, relPath, kind,
    meta.related_id || null, meta.caption || null, parseInt(meta.position || 0, 10), req.user.email,
  );
  audit({ actor: req.user.email, action: 'upload.created', entity: kind, entity_id: r.lastInsertRowid, meta: { size: req.file.size } });
  res.json({ ok: true, id: r.lastInsertRowid, url: publicUrlFor(relPath) });
});

router.patch('/:kind/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const fields = [], args = [];
  ['caption', 'position', 'active', 'related_id'].forEach((k) => {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); args.push(typeof req.body[k] === 'boolean' ? (req.body[k] ? 1 : 0) : req.body[k]); }
  });
  if (!fields.length) return res.json({ ok: true });
  args.push(id);
  getDb().prepare(`UPDATE uploads SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  audit({ actor: req.user.email, action: 'upload.updated', entity_id: id });
  res.json({ ok: true });
});

router.delete('/:kind/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = getDb().prepare('SELECT * FROM uploads WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ ok: false });
  try { unlinkSync(join(fsRoot(), row.path)); } catch {}
  getDb().prepare('DELETE FROM uploads WHERE id = ?').run(id);
  audit({ actor: req.user.email, action: 'upload.deleted', entity_id: id });
  res.json({ ok: true });
});

export default router;
