/* File storage abstraction. Defaults to local disk under /data/uploads;
   can be swapped for S3/R2 later by re-implementing `save` and `urlFor`.
*/
import { mkdirSync, createWriteStream, existsSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = process.env.UPLOAD_DIR || './data/uploads';

const ALLOWED_IMAGES = {
  'image/jpeg':    '.jpg',
  'image/png':     '.png',
  'image/webp':    '.webp',
  'image/gif':     '.gif',
  'image/svg+xml': '.svg',
};
const ALLOWED_VIDEOS = {
  'video/mp4':       '.mp4',
  'video/webm':      '.webm',
  'video/quicktime': '.mov',
};
const ALLOWED = { ...ALLOWED_IMAGES, ...ALLOWED_VIDEOS };

const MAX_IMAGE_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES       || (5  * 1024 * 1024), 10);
const MAX_VIDEO_BYTES = parseInt(process.env.UPLOAD_MAX_VIDEO_BYTES || (50 * 1024 * 1024), 10);

export function ensureDir(kind) {
  const dir = join(ROOT, kind);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function isAllowedMime(mime)  { return Object.prototype.hasOwnProperty.call(ALLOWED, mime); }
export function isVideoMime(mime)    { return Object.prototype.hasOwnProperty.call(ALLOWED_VIDEOS, mime); }
export function maxBytesFor(kind)    { return kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES; }
/** @deprecated use maxBytesFor(kind). Kept for backwards-compat. */
export function maxBytes()           { return MAX_IMAGE_BYTES; }
export function extFor(mime)         { return ALLOWED[mime] || ''; }

export function safeName(original) {
  const base = basename(original).replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
  return base || ('file' + Date.now());
}

export function newPath(kind, mime) {
  ensureDir(kind);
  const id = randomBytes(8).toString('hex');
  return {
    relPath: join(kind, id + extFor(mime)),
    absPath: join(ROOT, kind, id + extFor(mime)),
  };
}

export function publicUrlFor(relPath) {
  return '/uploads/' + relPath.replace(/\\/g, '/');
}

export function fsRoot() { return ROOT; }

export function statFile(relPath) {
  const abs = join(ROOT, relPath);
  return existsSync(abs) ? statSync(abs) : null;
}
