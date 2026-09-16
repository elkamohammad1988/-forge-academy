#!/usr/bin/env node
/* Online SQLite backup using the .backup pragma. Safe while the server runs.
   Usage:
     node scripts/backup.js [destination-dir]
   Default destination: ./backups/
*/
import 'dotenv/config';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.DB_PATH || './data/forge.db';
const DEST_DIR = process.argv[2] || './backups';
const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10);

if (!existsSync(SRC)) {
  console.error(`No database at ${SRC}`);
  process.exit(1);
}
mkdirSync(DEST_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out   = join(DEST_DIR, `forge-${stamp}.db`);

const db = new Database(SRC, { readonly: true });
await db.backup(out);
db.close();
const size = (statSync(out).size / 1024).toFixed(1);
console.log(`✓ Backup written to ${out} (${size} KB)`);

// Retention: keep the newest KEEP backups
const old = readdirSync(DEST_DIR)
  .filter((f) => f.startsWith('forge-') && f.endsWith('.db'))
  .map((f) => ({ f, t: statSync(join(DEST_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(KEEP);

old.forEach(({ f }) => {
  try { unlinkSync(join(DEST_DIR, f)); console.log(`  pruned ${f}`); } catch {}
});
