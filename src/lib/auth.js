import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s === 'replace-me-with-a-48-byte-random-secret') {
    throw new Error('JWT_SECRET is not configured');
  }
  return s;
};
const TTL_HOURS = () => parseInt(process.env.SESSION_TTL_HOURS || '720', 10);

export function signSession(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: `${TTL_HOURS()}h` });
}
export function verifySession(token) {
  try { return jwt.verify(token, SECRET()); } catch { return null; }
}
export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 12);
}
export function checkPassword(plain, hash) {
  if (!hash) return false;
  try { return bcrypt.compareSync(plain, hash); } catch { return false; }
}

export const COOKIE_NAME = 'forge_session';
export const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: TTL_HOURS() * 3600 * 1000,
});
