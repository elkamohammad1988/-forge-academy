// Test environment setup — runs before each suite.
import { rmSync } from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.DB_PATH  = './data/forge-test.db';
process.env.JWT_SECRET = 'test-secret-' + 'x'.repeat(48);
process.env.SESSION_TTL_HOURS = '1';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.EMAIL_TO_OWNER = 'owner@example.test';
// The suite makes ~50 /api/auth/* calls in one 15-minute window. The shipped
// cap (20) is a production security control, not a test concern — raise it
// here only, so the limiter still ships at its real default.
process.env.AUTH_RATE_LIMIT_MAX = '1000';

try { rmSync('./data/forge-test.db', { force: true }); } catch {}
