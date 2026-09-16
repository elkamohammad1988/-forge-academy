#!/usr/bin/env node
/* Populate the database with realistic demo data so screenshots, sales videos
   and Lighthouse runs look like a real, busy gym. Idempotent — running twice
   does nothing extra. Set `WIPE=1` to clear and reseed.
*/
import 'dotenv/config';
import { getDb, initDb, closeDb } from '../src/db.js';
import { hashPassword } from '../src/lib/auth.js';

initDb();
const db = getDb();

if (process.env.WIPE === '1') {
  console.log('⚠ WIPE=1 — clearing demo data…');
  db.exec(`
    DELETE FROM lead_notes;
    DELETE FROM bookings;
    DELETE FROM auth_tokens;
    DELETE FROM newsletter;
    DELETE FROM contacts;
    DELETE FROM leads;
    DELETE FROM members WHERE email LIKE 'demo+%@example.test' OR email = 'admin@demo.test';
    DELETE FROM audit_log;
    DELETE FROM class_capacity;
  `);
}

if (db.prepare(`SELECT id FROM members WHERE email = 'admin@demo.test'`).get()) {
  console.log('Demo data already present. Use WIPE=1 to reseed.');
  closeDb();
  process.exit(0);
}

// ─── Members ──────────────────────────────────────────────────────────────
const insertMember = db.prepare(`
  INSERT INTO members (email, password_hash, first_name, last_name, plan, role, email_verified_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);
const adminId = insertMember.run('admin@demo.test',  hashPassword('demo-admin-pass'),  'Demo', 'Owner',   null,        'admin').lastInsertRowid;
insertMember.run('coach@demo.test',          hashPassword('demo-coach-pass'),'Mateo', 'Silva',    null,        'coach');
insertMember.run('demo+sarah@example.test',  hashPassword('demo-pass-1234'), 'Sarah', 'King',     'unlimited', 'member');
insertMember.run('demo+james@example.test',  hashPassword('demo-pass-1234'), 'James', 'Mitchell', 'unlimited', 'member');
insertMember.run('demo+priya@example.test',  hashPassword('demo-pass-1234'), 'Priya', 'Raj',      'kids',      'member');
insertMember.run('demo+oliver@example.test', hashPassword('demo-pass-1234'), 'Oliver','Brooks',   null,        'member');

// ─── Leads (40 across 30 days) ────────────────────────────────────────────
const FIRST = ['Alex','Jamie','Taylor','Sam','Aisha','Leo','Isla','Noah','Maya','Ravi','Hannah','Tom','Sofia','Zara','Owen','Amelia','Finn','Lucas','Lily','Eva','Daniel','Mia','Harry','Lila','Ben','Nora','Ethan','Grace','Theo','Charlie','Anya','Liam','Ada','Mateo','Ines','Joe','Yara','Lina','Cole','Ari'];
const LAST  = ['Patel','Singh','Khan','Walker','Reid','Hughes','Owen','Carter','Bennett','Hill','Foster','Ward','Stone','Hart','Ali','Knight','Cooper','Rhodes','Hayes','Lane','Marsh','Holt','Pope','Doyle','Fox','Day','Page','Wells','Lloyd','Wood'];
const PROG  = ['Brazilian Jiu-Jitsu','Muay Thai','Boxing','Kids Karate (5–14)','Not sure yet — recommend something'];
const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TIMES = ['Early morning (6–8am)','Morning (9am–12pm)','Lunchtime (12–2pm)','Evening (5–8pm)','Late evening (8–9:30pm)'];
const HEAR  = ['Google search','Google ad','Instagram / Facebook','Friend or family','Walked past the gym','Other'];
const STATUS = ['new','new','new','contacted','contacted','booked','booked','closed'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const leadStmt = db.prepare(`
  INSERT INTO leads (first_name, last_name, email, phone, age, experience, program,
                     preferred_day, preferred_time, hear_about, notes, consent, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`);
const noteStmt = db.prepare(`INSERT INTO lead_notes (lead_id, author, body) VALUES (?, ?, ?)`);

for (let i = 0; i < 40; i++) {
  const first = pick(FIRST), last = pick(LAST);
  const age = Math.floor(Math.random() * 30); // 0..30 days ago
  const created = new Date(Date.now() - age * 86400 * 1000 - Math.floor(Math.random() * 86400 * 1000)).toISOString().replace('T',' ').slice(0,19);
  const status = pick(STATUS);
  const r = leadStmt.run(
    first, last,
    `demo+${first.toLowerCase()}.${last.toLowerCase()}${i}@example.test`,
    `07${String(700000000 + Math.floor(Math.random() * 99999999)).slice(0,9)}`,
    pick(['18–34','35–49','50+','15–17']),
    pick(['Complete beginner','Some experience (under 1 year)','Intermediate (1–3 years)']),
    pick(PROG), pick(DAYS), pick(TIMES), pick(HEAR),
    Math.random() < 0.3 ? pick(['Bringing a friend','Slight knee niggle, fine to train','Total beginner','Coming back after 6m off']) : null,
    status, created,
  );
  if (status === 'contacted' || status === 'booked') {
    noteStmt.run(r.lastInsertRowid, 'admin@demo.test', 'Replied — ' + (Math.random() < 0.5 ? 'wants Tuesday 6pm BJJ.' : 'asked about kit, sent guide.'));
  }
  if (status === 'booked') {
    noteStmt.run(r.lastInsertRowid, 'admin@demo.test', 'Booked into beginners class. ✅');
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────
const contactStmt = db.prepare(`
  INSERT INTO contacts (name, email, phone, topic, message, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const contacts = [
  ['Charlotte Hayes', 'demo+charlotte@example.test', '07700900111', 'Kids classes',           'Hi — do you accept 4-year-olds in the Tigers class? My son turns 5 next month.'],
  ['Mark Kowalski',   'demo+mark@example.test',     '07700900222', 'Corporate / private hire','We\'re a 20-person tech team in MediaCity looking for a one-off team-building boxing class.'],
  ['Yusuf Ahmed',     'demo+yusuf@example.test',    null,           'Membership question',     'Do you offer student discounts during summer term?'],
];
for (const c of contacts) {
  const t = new Date(Date.now() - Math.floor(Math.random() * 14) * 86400 * 1000).toISOString().replace('T',' ').slice(0,19);
  contactStmt.run(c[0], c[1], c[2], c[3], c[4], t);
}

// ─── Newsletter ───────────────────────────────────────────────────────────
const nl = db.prepare(`INSERT INTO newsletter (email) VALUES (?) ON CONFLICT(email) DO NOTHING`);
for (let i = 0; i < 87; i++) {
  nl.run(`demo+sub${i}@example.test`);
}

// ─── Class capacity overrides ─────────────────────────────────────────────
const cap = db.prepare(`INSERT INTO class_capacity (class_day, class_time, capacity) VALUES (?, ?, ?) ON CONFLICT(class_day, class_time) DO UPDATE SET capacity = excluded.capacity`);
cap.run(1, '18:00', 16); // BJJ Fundamentals — smaller mat
cap.run(6, '10:00', 12); // Kids Karate — smaller class size
cap.run(5, '19:15', 14); // Advanced sparring — restricted

// ─── Bookings (today + tomorrow + next week) ──────────────────────────────
const bookStmt = db.prepare(`
  INSERT INTO bookings (member_id, class_day, class_time, program, starts_at, status, waitlist_position)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
function nextOccurrence(day, time, offset = 0) {
  const now = new Date(); const [h, m] = time.split(':').map(Number);
  const d = new Date(now); let diff = (day - d.getDay() + 7) % 7;
  if (diff === 0 && d.getHours() * 60 + d.getMinutes() >= h * 60 + m) diff = 7;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(h, m, 0, 0); return d.toISOString();
}
const memberIds = db.prepare(`SELECT id FROM members WHERE email LIKE 'demo+%'`).all().map((r) => r.id);
const slots = [
  { day: 1, time: '06:30', prog: 'BJJ' },
  { day: 1, time: '18:00', prog: 'BJJ' },
  { day: 2, time: '17:00', prog: 'Kids' },
  { day: 3, time: '06:30', prog: 'BJJ' },
  { day: 4, time: '18:00', prog: 'BJJ' },
  { day: 6, time: '11:30', prog: 'Boxing' },
];
for (const s of slots) {
  const startsAt = nextOccurrence(s.day, s.time);
  for (let i = 0; i < memberIds.length; i++) {
    bookStmt.run(memberIds[i], s.day, s.time, s.prog, startsAt, 'confirmed', null);
  }
}

// Mark some bookings as attended (for charts / coach demo realism)
const attStmt = db.prepare(`INSERT OR IGNORE INTO attendance (booking_id, member_id, status, checked_in_by) VALUES (?, ?, ?, ?)`);
const recent = db.prepare(`SELECT id, member_id FROM bookings WHERE date(starts_at) <= date('now') LIMIT 8`).all();
recent.forEach((b, i) => attStmt.run(b.id, b.member_id, i % 4 === 0 ? 'late' : 'attended', adminId));

console.log(`✓ Demo data seeded.`);
console.log(`  Admin:  admin@demo.test       / demo-admin-pass`);
console.log(`  Coach:  coach@demo.test       / demo-coach-pass`);
console.log(`  Member: demo+sarah@example.test / demo-pass-1234`);
console.log(`  ${db.prepare('SELECT COUNT(*) AS c FROM leads').get().c} leads, ${db.prepare('SELECT COUNT(*) AS c FROM bookings').get().c} bookings, ${db.prepare('SELECT COUNT(*) AS c FROM newsletter').get().c} newsletter subs.`);
closeDb();
