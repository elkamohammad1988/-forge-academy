/* Member achievement engine. Pure functions — no scheduling, no I/O beyond
   the DB write. Call `evaluateAchievements(memberId)` after a state-changing
   action (booking confirmed, attendance marked, plan upgrade) and it grants
   any newly-earned badges.
*/
import { getDb } from '../db.js';

export const CATALOG = [
  { code: 'first-class',     name: 'First Class',          icon: '🥋', desc: 'Showed up for your very first class.' },
  { code: 'classes-5',       name: '5 Classes',            icon: '🎯', desc: 'Five classes attended.' },
  { code: 'classes-25',      name: '25 Classes',           icon: '🏅', desc: 'Twenty-five classes — half-stripe territory.' },
  { code: 'classes-100',     name: '100 Classes',          icon: '💯', desc: 'A hundred classes. Officially a regular.' },
  { code: 'streak-7',        name: '7-Day Streak',         icon: '🔥', desc: 'Trained at least once a day, seven days running.' },
  { code: 'streak-30',       name: '30-Day Streak',        icon: '⚡', desc: 'A whole month without a missed week.' },
  { code: 'all-disciplines', name: 'All Four Disciplines', icon: '🌟', desc: 'Tried BJJ, Muay Thai, Boxing and Kids/Karate.' },
  { code: 'sunrise-warrior', name: 'Sunrise Warrior',      icon: '🌅', desc: 'Five 6:30am classes attended.' },
  { code: 'plan-unlimited',  name: 'Unlimited Member',     icon: '👑', desc: 'Subscribed to the Unlimited plan.' },
];

function grant(memberId, code) {
  try {
    getDb().prepare(`INSERT INTO achievements (member_id, code) VALUES (?, ?) ON CONFLICT(member_id, code) DO NOTHING`).run(memberId, code);
  } catch {}
}

export function evaluateAchievements(memberId) {
  const db = getDb();
  const member = db.prepare(`SELECT plan FROM members WHERE id = ?`).get(memberId);
  if (!member) return;

  const attended = db.prepare(`
    SELECT b.program, b.class_time, b.starts_at
    FROM bookings b JOIN attendance a ON a.booking_id = b.id
    WHERE b.member_id = ? AND a.status IN ('attended', 'late')
    ORDER BY b.starts_at ASC
  `).all(memberId);

  if (attended.length >= 1)   grant(memberId, 'first-class');
  if (attended.length >= 5)   grant(memberId, 'classes-5');
  if (attended.length >= 25)  grant(memberId, 'classes-25');
  if (attended.length >= 100) grant(memberId, 'classes-100');

  // All four disciplines
  const progs = new Set(attended.map((a) => normalizeProg(a.program)));
  if (progs.size >= 4) grant(memberId, 'all-disciplines');

  // Sunrise warrior — 5 classes at 06:30
  const sunrise = attended.filter((a) => a.class_time === '06:30').length;
  if (sunrise >= 5) grant(memberId, 'sunrise-warrior');

  // Streaks (consecutive days containing at least one attended class)
  const days = Array.from(new Set(attended.map((a) => a.starts_at.slice(0, 10)))).sort();
  let best = 0, run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const cur  = new Date(days[i]);
    const diff = Math.round((cur - prev) / 86400000);
    run = (diff === 1) ? run + 1 : 1;
    if (run > best) best = run;
  }
  if (best >= 7)  grant(memberId, 'streak-7');
  if (best >= 30) grant(memberId, 'streak-30');

  if (member.plan === 'unlimited' || member.plan === 'family') grant(memberId, 'plan-unlimited');
}

function normalizeProg(p) {
  const m = String(p || '').toLowerCase();
  if (m.startsWith('bjj') || m.includes('jiu')) return 'BJJ';
  if (m.includes('muay')) return 'MuayThai';
  if (m.includes('box'))  return 'Boxing';
  if (m.includes('karate') || m.includes('kid')) return 'Kids';
  return p;
}

export function listFor(memberId) {
  const earned = new Set(getDb().prepare(`SELECT code FROM achievements WHERE member_id = ?`).all(memberId).map((r) => r.code));
  return CATALOG.map((c) => ({ ...c, earned: earned.has(c.code), earnedAt: null }));
}

export function streakDays(memberId) {
  const days = getDb().prepare(`
    SELECT DISTINCT date(b.starts_at) AS d
    FROM bookings b JOIN attendance a ON a.booking_id = b.id
    WHERE b.member_id = ? AND a.status IN ('attended','late')
    ORDER BY d DESC LIMIT 60
  `).all(memberId).map((r) => r.d);

  if (!days.length) return 0;
  // Allow today or yesterday to start the streak
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yest) return 0;

  let count = 1;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1]); const b = new Date(days[i]);
    if (Math.round((a - b) / 86400000) === 1) count++; else break;
  }
  return count;
}
