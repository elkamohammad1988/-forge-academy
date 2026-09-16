import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db.js';

let app;
const ORIGIN = 'http://localhost:3000';

beforeAll(() => {
  // Ensure at least one blog post exists for the blog test
  if (!existsSync('content/blog')) mkdirSync('content/blog', { recursive: true });
  writeFileSync('content/blog/test-post.md',
    '---\ntitle: Test Post\nsummary: Just a test.\npublished: 2026-01-01\n---\nHello.\n');
  app = createApp();
});
afterAll(() => {
  // The fixture above is written into the real content directory, which the
  // blog build reads — remove it so a test run never leaks a "Test Post" into
  // the published blog.
  try { rmSync('content/blog/test-post.md', { force: true }); } catch { /* best effort */ }
  closeDb();
});

describe('health', () => {
  it('GET /api/health returns ok', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

describe('schedule', () => {
  it('GET /api/schedule decorates classes with capacity & spots_left', async () => {
    const r = await request(app).get('/api/schedule');
    expect(r.status).toBe(200);
    expect(r.body.schedule.length).toBeGreaterThanOrEqual(24);
    expect(r.body.schedule[0]).toHaveProperty('capacity');
    expect(r.body.schedule[0]).toHaveProperty('spots_left');
  });

  it('GET /api/schedule/next returns a future class', async () => {
    const r = await request(app).get('/api/schedule/next');
    expect(r.status).toBe(200);
    expect(r.body.next).toBeTruthy();
    expect(new Date(r.body.next.starts_at).getTime()).toBeGreaterThan(Date.now() - 5_000);
  });
});

describe('leads', () => {
  it('rejects cross-origin POST', async () => {
    const r = await request(app).post('/api/leads').set('Origin', 'https://evil.example.com')
      .send({ firstName: 'Sam', email: 'sam@example.com' });
    expect(r.status).toBe(403);
  });

  it('accepts a valid lead and stores it', async () => {
    const r = await request(app).post('/api/leads').set('Origin', ORIGIN).send({
      firstName: 'Alex', lastName: 'Bennett',
      email: 'alex@example.test', phone: '07700 900 123',
      program: 'Brazilian Jiu-Jitsu', consent: true,
    });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.id).toBe('number');
  });

  it('drops honeypot-filled submissions silently', async () => {
    const r = await request(app).post('/api/leads').set('Origin', ORIGIN)
      .send({ firstName: 'Bot', email: 'bot@example.test', website: 'https://spam' });
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(0);
  });

  it('422 on missing required fields', async () => {
    const r = await request(app).post('/api/leads').set('Origin', ORIGIN).send({ email: 'no-name@example.test' });
    expect(r.status).toBe(422);
  });
});

describe('contact + newsletter', () => {
  it('accepts a contact message', async () => {
    const r = await request(app).post('/api/contact').set('Origin', ORIGIN)
      .send({ firstName: 'Priya', email: 'priya@example.test', message: 'Question about kids classes.' });
    expect(r.status).toBe(200);
  });
  it('subscribes to newsletter (idempotent)', async () => {
    await request(app).post('/api/newsletter').set('Origin', ORIGIN).send({ email: 'sub@example.test' });
    const r = await request(app).post('/api/newsletter').set('Origin', ORIGIN).send({ email: 'sub@example.test' });
    expect(r.status).toBe(200);
  });
});

describe('auth — registration & login', () => {
  let cookie;

  it('registers a new member', async () => {
    const r = await request(app).post('/api/auth/register').set('Origin', ORIGIN).send({
      firstName: 'Test', lastName: 'User',
      email: 'member@example.test', password: 'super-secret-pw', consent: true,
    });
    expect(r.status).toBe(200);
    expect(r.body.member.email).toBe('member@example.test');
    cookie = r.headers['set-cookie'];
  });

  it('blocks duplicate registration', async () => {
    const r = await request(app).post('/api/auth/register').set('Origin', ORIGIN)
      .send({ firstName: 'Dup', email: 'member@example.test', password: 'super-secret-pw', consent: true });
    expect(r.status).toBe(409);
  });

  it('GET /api/auth/me returns the signed-in member', async () => {
    const r = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(r.body.member.email).toBe('member@example.test');
    expect(r.body.member.emailVerified).toBe(false);
  });

  it('login fails with wrong password', async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'wrong' });
    expect(r.status).toBe(401);
  });

  it('logout clears the session', async () => {
    const r = await request(app).post('/api/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie);
    expect(r.status).toBe(200);
  });
});

describe('auth — password reset & email verification', () => {
  it('forgot endpoint always returns ok (does not leak account existence)', async () => {
    const r1 = await request(app).post('/api/auth/forgot').set('Origin', ORIGIN).send({ email: 'no-such@example.test' });
    expect(r1.status).toBe(200);
    expect(r1.body.ok).toBe(true);
    const r2 = await request(app).post('/api/auth/forgot').set('Origin', ORIGIN).send({ email: 'member@example.test' });
    expect(r2.status).toBe(200);
  });

  it('reset endpoint rejects bad/expired tokens', async () => {
    const r = await request(app).post('/api/auth/reset').set('Origin', ORIGIN)
      .send({ token: 'definitely-not-a-real-token', password: 'newpassword123' });
    expect(r.status).toBe(400);
  });

  it('reset endpoint completes with a valid token', async () => {
    // Simulate the token issuance directly via the lib
    const { issueToken } = await import('../src/lib/tokens.js');
    const { getDb } = await import('../src/db.js');
    const member = getDb().prepare('SELECT id FROM members WHERE email = ?').get('member@example.test');
    const token = issueToken(member.id, 'reset');
    const r = await request(app).post('/api/auth/reset').set('Origin', ORIGIN)
      .send({ token, password: 'a-new-password' });
    expect(r.status).toBe(200);

    // Old password no longer works
    const r2 = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'super-secret-pw' });
    expect(r2.status).toBe(401);
    // New password works
    const r3 = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'a-new-password' });
    expect(r3.status).toBe(200);
  });

  it('verify-email completes with a valid token', async () => {
    const { issueToken } = await import('../src/lib/tokens.js');
    const { getDb } = await import('../src/db.js');
    const m = getDb().prepare('SELECT id FROM members WHERE email = ?').get('member@example.test');
    const token = issueToken(m.id, 'verify');
    const r = await request(app).post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

describe('auth — profile & password change', () => {
  let cookie;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'a-new-password' });
    cookie = r.headers['set-cookie'];
  });

  it('updates profile fields', async () => {
    const r = await request(app).patch('/api/auth/profile').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ firstName: 'Updated', phone: '07000 000 000' });
    expect(r.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.member.firstName).toBe('Updated');
    expect(me.body.member.phone).toBe('07000 000 000');
  });

  it('rejects change-password when current is wrong', async () => {
    const r = await request(app).post('/api/auth/change-password').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ currentPassword: 'wrong', newPassword: 'irrelevant-but-long-enough' });
    expect(r.status).toBe(401);
  });

  it('changes the password with the current one', async () => {
    const r = await request(app).post('/api/auth/change-password').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ currentPassword: 'a-new-password', newPassword: 'an-even-newer-pw' });
    expect(r.status).toBe(200);
  });
});

describe('bookings — capacity & waitlist', () => {
  let cookie;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    cookie = r.headers['set-cookie'];
  });

  it('blocks booking until the liability waiver is signed', async () => {
    const blocked = await request(app).post('/api/bookings').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ classDay: 1, classTime: '06:30', program: 'BJJ' });
    expect(blocked.status).toBe(412);
    expect(blocked.body.needs_waiver).toBe(true);

    const signed = await request(app).post('/api/waivers/sign').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ signer_name: 'Member Example', signature_dataurl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg' });
    expect(signed.status).toBe(200);
  });

  it('books a class and returns confirmed status', async () => {
    const r = await request(app).post('/api/bookings').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ classDay: 1, classTime: '06:30', program: 'BJJ' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('confirmed');
  });

  it('rejects double-booking the same class', async () => {
    const r = await request(app).post('/api/bookings').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ classDay: 1, classTime: '06:30', program: 'BJJ' });
    expect(r.status).toBe(409);
  });

  it('lists upcoming bookings', async () => {
    const r = await request(app).get('/api/bookings').set('Cookie', cookie);
    expect(r.status).toBe(200);
    expect(r.body.bookings.length).toBeGreaterThan(0);
  });

  it('cancels the booking', async () => {
    const list = await request(app).get('/api/bookings').set('Cookie', cookie);
    const id = list.body.bookings[0].id;
    const r = await request(app).delete('/api/bookings/' + id).set('Cookie', cookie).set('Origin', ORIGIN);
    expect(r.status).toBe(200);
  });
});

describe('admin', () => {
  it('rejects unauthenticated access', async () => {
    const r = await request(app).get('/api/admin/stats');
    expect(r.status).toBe(401);
  });
  it('rejects non-admin members', async () => {
    const reg = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    const r = await request(app).get('/api/admin/stats').set('Cookie', reg.headers['set-cookie']);
    expect(r.status).toBe(403);
  });
});

describe('blog', () => {
  it('lists at least one post', async () => {
    const r = await request(app).get('/api/blog');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.posts)).toBe(true);
    expect(r.body.posts.length).toBeGreaterThan(0);
  });
  it('returns a post by slug', async () => {
    const list = await request(app).get('/api/blog');
    const slug = list.body.posts[0].slug;
    const r = await request(app).get('/api/blog/' + slug);
    expect(r.status).toBe(200);
    expect(r.body.post.slug).toBe(slug);
    expect(r.body.post.body).toBeTruthy();
  });
  it('404s on unknown slug', async () => {
    const r = await request(app).get('/api/blog/no-such-post');
    expect(r.status).toBe(404);
  });
});

describe('meta', () => {
  it('serves Prometheus metrics', async () => {
    const r = await request(app).get('/api/metrics');
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/forge_uptime_seconds/);
    expect(r.text).toMatch(/forge_db_rows\{table="leads"\}/);
  });
  it('serves an OpenAPI 3.1 document', async () => {
    const r = await request(app).get('/api/openapi.json');
    expect(r.status).toBe(200);
    expect(r.body.openapi).toMatch(/^3\./);
    expect(r.body.paths['/health']).toBeTruthy();
  });
  it('exposes brand + features at /api/brand', async () => {
    const r = await request(app).get('/api/brand');
    expect(r.status).toBe(200);
    expect(r.body.brand).toBeTruthy();
    expect(r.body.brand.name).toBeTruthy();
    expect(r.body.features).toBeTruthy();
  });
  it('runs a deep health check', async () => {
    const r = await request(app).get('/api/health/deep');
    expect([200, 503]).toContain(r.status);
    expect(r.body.checks.db.ok).toBe(true);
    expect(typeof r.body.checks.uptime_seconds).toBe('number');
  });
});

describe('referrals', () => {
  let cookie;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    cookie = r.headers['set-cookie'];
  });
  it('issues a stable referral code with a /index.html?ref= link', async () => {
    const r = await request(app).get('/api/referrals/me').set('Cookie', cookie);
    expect(r.status).toBe(200);
    expect(r.body.code).toBeTruthy();
    expect(r.body.link).toMatch(/[?&]ref=/);
    const r2 = await request(app).get('/api/referrals/me').set('Cookie', cookie);
    expect(r2.body.code).toBe(r.body.code);
  });
});

describe('push', () => {
  let cookie;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    cookie = r.headers['set-cookie'];
  });
  it('exposes the public-key endpoint', async () => {
    const r = await request(app).get('/api/push/public-key');
    expect(r.status).toBe(200);
    expect(typeof r.body.enabled).toBe('boolean');
  });
  it('rejects unauthenticated subscribe', async () => {
    const r = await request(app).post('/api/push/subscribe').set('Origin', ORIGIN)
      .send({ endpoint: 'https://example.test/push', keys: { p256dh: 'x'.repeat(80), auth: 'aaaaaaaa' } });
    expect(r.status).toBe(401);
  });
  it('accepts a valid subscription', async () => {
    const r = await request(app).post('/api/push/subscribe').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ endpoint: 'https://example.test/push/abc', keys: { p256dh: 'x'.repeat(80), auth: 'aaaaaaaa' } });
    expect(r.status).toBe(200);
  });
});

describe('CSV import', () => {
  let admin;
  beforeAll(async () => {
    // First suite to hit /api/admin/* — promote the shared account to admin.
    const { getDb } = await import('../src/db.js');
    getDb().prepare(`UPDATE members SET role='admin' WHERE email = ?`).run('member@example.test');
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    admin = r.headers['set-cookie'];
  });
  it('imports newsletter subscribers from CSV', async () => {
    const csv = 'email\ncsv1@example.test\ncsv2@example.test\nnotanemail\n';
    const r = await request(app).post('/api/admin/import/newsletter')
      .set('Cookie', admin).set('Origin', ORIGIN)
      .set('Content-Type', 'text/csv').send(csv);
    expect(r.status).toBe(200);
    expect(r.body.inserted).toBe(2);
  });
});

describe('waivers', () => {
  let cookie;
  beforeAll(async () => {
    await request(app).post('/api/auth/register').set('Origin', ORIGIN)
      .send({ firstName: 'Waiver', email: 'waiver@example.test', password: 'pw-pw-pw-pw', consent: true });
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'waiver@example.test', password: 'pw-pw-pw-pw' });
    cookie = r.headers['set-cookie'];
  });
  it('serves the current waiver publicly', async () => {
    const r = await request(app).get('/api/waivers/current');
    expect(r.status).toBe(200);
    expect(r.body.waiver.body_md).toMatch(/Liability/i);
  });
  it('member sees unsigned status, then signs once', async () => {
    const before = await request(app).get('/api/waivers/me/status').set('Cookie', cookie);
    expect(before.body.signed).toBe(false);
    const sign = await request(app).post('/api/waivers/sign').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({
        signer_name: 'Test User',
        signature_dataurl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg',
      });
    expect(sign.status).toBe(200);
    const after = await request(app).get('/api/waivers/me/status').set('Cookie', cookie);
    expect(after.body.signed).toBe(true);
    const second = await request(app).post('/api/waivers/sign').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ signer_name: 'Test User', signature_dataurl: 'data:image/png;base64,iVBORw0' });
    expect(second.status).toBe(409);
  });
});

describe('2FA TOTP', () => {
  let cookie;
  beforeAll(async () => {
    await request(app).post('/api/auth/register').set('Origin', ORIGIN)
      .send({ firstName: 'TwoFA', email: 'tfa@example.test', password: 'tfa-tfa-tfa-1', consent: true });
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'tfa@example.test', password: 'tfa-tfa-tfa-1' });
    cookie = r.headers['set-cookie'];
  });
  it('starts disabled', async () => {
    const r = await request(app).get('/api/auth/2fa/status').set('Cookie', cookie);
    expect(r.body.enabled).toBe(false);
  });
  it('setup → enable round-trip; login then requires TOTP', async () => {
    const setup = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie).set('Origin', ORIGIN).send({});
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    const { generateCode } = await import('../src/lib/totp.js');
    const code = generateCode(setup.body.secret);
    const enable = await request(app).post('/api/auth/2fa/enable').set('Cookie', cookie).set('Origin', ORIGIN).send({ code });
    expect(enable.status).toBe(200);
    expect(enable.body.recovery_codes).toHaveLength(10);

    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'tfa@example.test', password: 'tfa-tfa-tfa-1' });
    expect(r.status).toBe(401);
    expect(r.body.needs_totp).toBe(true);
  });
});

describe('belt grading', () => {
  let admin, member;
  beforeAll(async () => {
    const a = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    admin = a.headers['set-cookie'];
    // create + login a separate test member
    await request(app).post('/api/auth/register').set('Origin', ORIGIN)
      .send({ firstName: 'Belt', email: 'beltmember@example.test', password: 'pw-pw-pw-pw', consent: true });
    const m = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'beltmember@example.test', password: 'pw-pw-pw-pw' });
    member = m.headers['set-cookie'];
  });
  it('exposes the rank catalogue', async () => {
    const r = await request(app).get('/api/gradings/ranks');
    expect(r.status).toBe(200);
    expect(r.body.ranks.BJJ).toContain('Blue');
  });
  it('admin grants a grading; member sees it', async () => {
    const me = await request(app).get('/api/auth/me').set('Cookie', member);
    const id = me.body.member.id;
    const g = await request(app).post('/api/gradings/grant').set('Cookie', admin).set('Origin', ORIGIN)
      .send({ member_id: id, discipline: 'BJJ', rank: 'White', stripes: 1 });
    expect(g.status).toBe(200);
    const t = await request(app).get('/api/gradings/me').set('Cookie', member);
    expect(t.body.timeline.length).toBeGreaterThan(0);
    expect(t.body.current.BJJ.rank).toBe('White');
  });
});

describe('membership pauses', () => {
  let cookie;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'beltmember@example.test', password: 'pw-pw-pw-pw' });
    cookie = r.headers['set-cookie'];
  });
  it('rejects an inverted date range', async () => {
    const r = await request(app).post('/api/pauses/me').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ starts_on: '2027-01-10', ends_on: '2027-01-05' });
    expect(r.status).toBe(422);
  });
  it('auto-approves a short pause', async () => {
    const r = await request(app).post('/api/pauses/me').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ starts_on: '2027-01-01', ends_on: '2027-01-30', reason: 'holiday' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('active');
  });
  it('lists my pauses', async () => {
    const r = await request(app).get('/api/pauses/me').set('Cookie', cookie);
    expect(r.body.pauses.length).toBeGreaterThan(0);
  });
});

describe('PT (personal training)', () => {
  let coachCookie, memberCookie, slotId;
  beforeAll(async () => {
    // This suite runs before the `coach` suite, so the coach account does not
    // exist yet — create and promote it here (the later register is a no-op).
    const { getDb } = await import('../src/db.js');
    await request(app).post('/api/auth/register').set('Origin', ORIGIN).send({
      firstName: 'Coach', email: 'coach@example.test',
      password: 'coach-strong-pw', consent: true,
    });
    getDb().prepare(`UPDATE members SET role = 'coach' WHERE email = ?`).run('coach@example.test');
    const c = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'coach@example.test', password: 'coach-strong-pw' });
    coachCookie = c.headers['set-cookie'];
    const m = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'beltmember@example.test', password: 'pw-pw-pw-pw' });
    memberCookie = m.headers['set-cookie'];
    // PT booking is waiver-gated exactly like class booking — sign once.
    await request(app).post('/api/waivers/sign').set('Cookie', memberCookie).set('Origin', ORIGIN)
      .send({ signer_name: 'Belt Member', signature_dataurl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg' });
  });
  it('coach publishes a slot', async () => {
    const r = await request(app).post('/api/pt/me/slots').set('Cookie', coachCookie).set('Origin', ORIGIN)
      .send({ starts_at: '2027-06-01T18:00:00.000Z', duration: 60, price_pence: 0, notes: 'Free intro' });
    expect(r.status).toBe(200);
    slotId = r.body.id;
  });
  it('open slots include the new one', async () => {
    const r = await request(app).get('/api/pt/slots');
    expect(r.body.slots.find((s) => s.id === slotId)).toBeTruthy();
  });
  it('member books a free slot directly (no Stripe)', async () => {
    const r = await request(app).post('/api/pt/book/' + slotId).set('Cookie', memberCookie).set('Origin', ORIGIN);
    expect(r.status).toBe(200);
    expect(r.body.free).toBe(true);
  });
});

describe('iCal feed', () => {
  it('serves a valid ICS document', async () => {
    const r = await request(app).get('/calendar/forge.ics');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/calendar/);
    expect(r.text).toMatch(/^BEGIN:VCALENDAR/);
    expect(r.text).toMatch(/END:VCALENDAR\s*$/);
    expect(r.text).toMatch(/BEGIN:VEVENT/);
  });
});

describe('admin schedule editor', () => {
  let admin;
  beforeAll(async () => {
    // Promote member@example.test to admin for these tests
    const { getDb } = await import('../src/db.js');
    getDb().prepare(`UPDATE members SET role='admin' WHERE email = ?`).run('member@example.test');
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    admin = r.headers['set-cookie'];
  });
  it('lists, creates, updates, deletes a class', async () => {
    const list1 = await request(app).get('/api/admin/schedule').set('Cookie', admin);
    expect(list1.status).toBe(200);

    const created = await request(app).post('/api/admin/schedule').set('Cookie', admin).set('Origin', ORIGIN)
      .send({ day: 1, time: '20:00', duration: 60, prog: 'BJJ', title: 'Test class' });
    expect(created.status).toBe(200);
    const id = created.body.id;

    const updated = await request(app).patch('/api/admin/schedule/' + id).set('Cookie', admin).set('Origin', ORIGIN)
      .send({ capacity: 8 });
    expect(updated.status).toBe(200);

    const deleted = await request(app).delete('/api/admin/schedule/' + id).set('Cookie', admin).set('Origin', ORIGIN);
    expect(deleted.status).toBe(200);
  });
});

describe('admin webhooks', () => {
  let admin;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'member@example.test', password: 'an-even-newer-pw' });
    admin = r.headers['set-cookie'];
  });
  it('lists supported events', async () => {
    const r = await request(app).get('/api/admin/webhooks/events').set('Cookie', admin);
    expect(r.status).toBe(200);
    expect(r.body.events).toContain('lead.created');
  });
  it('creates and deletes a subscription', async () => {
    const c = await request(app).post('/api/admin/webhooks').set('Cookie', admin).set('Origin', ORIGIN)
      .send({ url: 'https://example.test/hook', events: 'lead.created' });
    expect(c.status).toBe(200);
    const d = await request(app).delete('/api/admin/webhooks/' + c.body.id).set('Cookie', admin).set('Origin', ORIGIN);
    expect(d.status).toBe(200);
  });
});

describe('GDPR', () => {
  let cookie;
  beforeAll(async () => {
    await request(app).post('/api/auth/register').set('Origin', ORIGIN)
      .send({ firstName: 'GD', email: 'gdpr-user@example.test', password: 'a-strong-pw', consent: true });
    const l = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'gdpr-user@example.test', password: 'a-strong-pw' });
    cookie = l.headers['set-cookie'];
  });
  it('exports all of my data as JSON', async () => {
    const r = await request(app).get('/api/gdpr/me/export').set('Cookie', cookie);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    const body = JSON.parse(r.text);
    expect(body.member.email).toBe('gdpr-user@example.test');
  });
  it('deletes (anonymises) my account', async () => {
    const r = await request(app).post('/api/gdpr/me/delete').set('Cookie', cookie).set('Origin', ORIGIN);
    expect(r.status).toBe(200);
  });
});

describe('coach', () => {
  let memberCookie, coachCookie;

  beforeAll(async () => {
    // A plain, non-staff member: member@example.test was promoted to admin by
    // the admin suites above, and requireCoach admits admins as well as coaches.
    const m = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'beltmember@example.test', password: 'pw-pw-pw-pw' });
    memberCookie = m.headers['set-cookie'];

    // Register a new account, then promote it to coach via direct DB
    await request(app).post('/api/auth/register').set('Origin', ORIGIN).send({
      firstName: 'Coach', email: 'coach@example.test',
      password: 'coach-strong-pw', consent: true,
    });
    const { getDb } = await import('../src/db.js');
    getDb().prepare(`UPDATE members SET role = 'coach' WHERE email = ?`).run('coach@example.test');
    const c = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
      .send({ email: 'coach@example.test', password: 'coach-strong-pw' });
    coachCookie = c.headers['set-cookie'];
  });

  it('member can rotate a check-in token', async () => {
    const r = await request(app).post('/api/coach/me/checkin-token').set('Cookie', memberCookie).set('Origin', ORIGIN).send({});
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });

  it('rejects non-coach access to roster', async () => {
    const r = await request(app).get('/api/coach/roster').set('Cookie', memberCookie);
    expect(r.status).toBe(403);
  });

  it('coach can see today\'s roster', async () => {
    const r = await request(app).get('/api/coach/roster').set('Cookie', coachCookie);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.classes)).toBe(true);
  });
});
