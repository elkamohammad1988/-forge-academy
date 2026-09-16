import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_PATH = process.env.DB_PATH || './data/forge.db';
const __filename = fileURLToPath(import.meta.url);
const MIGRATIONS_DIR = join(dirname(__filename), 'db', 'migrations');

let _db = null;

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  if (!existsSync(MIGRATIONS_DIR)) return [];

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set(db.prepare('SELECT filename FROM schema_migrations').all().map((r) => r.filename));
  const ran = [];
  const insertStmt = db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insertStmt.run(file);
    })();
    ran.push(file);
  }
  return ran;
}

export function getDb() {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  const ran = runMigrations(_db);
  if (ran.length && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`✓ Applied ${ran.length} migration(s): ${ran.join(', ')}`);
  }
  return _db;
}

export function initDb() {
  const db = getDb();
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`✓ Database ready at ${DB_PATH}`);
  }
  return db;
}

export function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

export const audit = (entry) => {
  getDb().prepare(`
    INSERT INTO audit_log (actor, action, entity, entity_id, meta, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.actor || null,
    entry.action,
    entry.entity || null,
    entry.entity_id || null,
    entry.meta ? JSON.stringify(entry.meta) : null,
    entry.ip || null,
  );
};
