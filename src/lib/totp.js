/* RFC 6238 TOTP implementation using Node's built-in crypto.
   No npm dep. Compatible with Google / Microsoft / 1Password authenticators.
*/
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32encode(bytes) {
  let out = '', bits = 0, value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

export function base32decode(input) {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const out = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i === -1) throw new Error('Invalid base32 character: ' + ch);
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function generateSecret(bytes = 20) {
  return base32encode(randomBytes(bytes));
}

export function generateCode(secretB32, t = Date.now()) {
  const counter = Math.floor(t / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32decode(secretB32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
             | ((hmac[offset + 1] & 0xff) << 16)
             | ((hmac[offset + 2] & 0xff) << 8)
             |  (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyCode(secretB32, code, window = 1) {
  if (!code || !/^\d{6}$/.test(String(code))) return false;
  const now = Date.now();
  for (let w = -window; w <= window; w++) {
    if (generateCode(secretB32, now + w * 30_000) === code) return true;
  }
  return false;
}

export function otpauthUrl(secretB32, label, issuer = 'Forge') {
  const enc = (s) => encodeURIComponent(s);
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${enc(secretB32)}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function makeRecoveryCodes(n = 10) {
  return Array.from({ length: n }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
}
