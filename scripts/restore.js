#!/usr/bin/env node
/* Restore a SQLite backup over the live database.
   Usage:
     node scripts/restore.js <path-to-backup.db>
   The current DB is moved to forge.db.before-restore-<timestamp> for safety.
*/
import 'dotenv/config';
import { existsSync, copyFileSync, renameSync } from 'node:fs';

const SRC = process.argv[2];
const DB  = process.env.DB_PATH || './data/forge.db';

if (!SRC) {
  console.error('Usage: node scripts/restore.js <path-to-backup.db>');
  process.exit(1);
}
if (!existsSync(SRC)) {
  console.error(`Backup not found: ${SRC}`);
  process.exit(1);
}

if (existsSync(DB)) {
  const backup = `${DB}.before-restore-${Date.now()}`;
  renameSync(DB, backup);
  console.log(`Moved current DB to ${backup}`);
}
copyFileSync(SRC, DB);
console.log(`✓ Restored ${SRC} → ${DB}. Restart the server.`);
