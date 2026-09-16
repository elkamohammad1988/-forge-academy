#!/usr/bin/env node
/* Bootstrap an admin account.
   Usage:
     node scripts/create-admin.js <email> <password> [firstName]
   The account is created (or upgraded to admin if it already exists).
*/
import 'dotenv/config';
import { getDb, closeDb, initDb } from '../src/db.js';
import { hashPassword } from '../src/lib/auth.js';

const [, , email, password, firstName] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js <email> <password> [firstName]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

initDb();
const db = getDb();
const existing = db.prepare('SELECT id FROM members WHERE email = ?').get(email.toLowerCase());

if (existing) {
  db.prepare(`UPDATE members SET role = 'admin', password_hash = ? WHERE id = ?`).run(hashPassword(password), existing.id);
  console.log(`✓ Existing member ${email} promoted to admin and password reset.`);
} else {
  const r = db.prepare(`
    INSERT INTO members (email, password_hash, first_name, role)
    VALUES (?, ?, ?, 'admin')
  `).run(email.toLowerCase(), hashPassword(password), firstName || 'Admin');
  console.log(`✓ Admin created (id=${r.lastInsertRowid}, email=${email}).`);
}

closeDb();
