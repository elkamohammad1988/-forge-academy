#!/usr/bin/env node
/* First-run setup wizard. Generates a working .env, initializes the database,
   and (optionally) seeds demo data + creates an admin in one go.
   Usage: node scripts/setup.js
*/
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execSync } from 'node:child_process';

const rl = createInterface({ input: stdin, output: stdout });

async function ask(q, def) {
  const ans = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim();
  return ans || def || '';
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Forge Academy — first-run setup');
console.log('═══════════════════════════════════════════════════════════\n');

if (existsSync('.env')) {
  const overwrite = await ask('A .env already exists. Overwrite? (y/N)', 'N');
  if (overwrite.toLowerCase() !== 'y') {
    console.log('Keeping existing .env. Skipping to admin creation.');
  } else {
    writeEnv();
  }
} else {
  writeEnv();
}

async function writeEnv() {
  const example = readFileSync('.env.example', 'utf8');
  const port = await ask('Port to listen on', '3000');
  const url  = await ask('Public URL (used in emails)', `http://localhost:${port}`);
  const ownerEmail = await ask('Owner email (where leads get sent)', 'hello@example.com');
  const jwt = randomBytes(48).toString('base64url');

  const env = example
    .replace(/^PORT=.*/m, `PORT=${port}`)
    .replace(/^PUBLIC_URL=.*/m, `PUBLIC_URL=${url}`)
    .replace(/^ALLOWED_ORIGINS=.*/m, `ALLOWED_ORIGINS=${url}`)
    .replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${jwt}`)
    .replace(/^EMAIL_TO_OWNER=.*/m, `EMAIL_TO_OWNER=${ownerEmail}`);
  writeFileSync('.env', env);
  console.log(`✓ Wrote .env (JWT_SECRET generated, owner email = ${ownerEmail})`);
}

console.log('\n— Database —');
execSync('npm run db:init', { stdio: 'inherit' });

const wantSeed = (await ask('\nSeed demo data (40 leads, 5 members, 87 newsletter subs)? (Y/n)', 'Y')).toLowerCase();
if (wantSeed !== 'n') {
  execSync('node scripts/seed-demo.js', { stdio: 'inherit', env: { ...process.env, WIPE: '1' } });
}

console.log('\n— Admin account —');
const wantAdmin = (await ask('Create an admin account now? (Y/n)', 'Y')).toLowerCase();
if (wantAdmin !== 'n') {
  const email    = await ask('Admin email', 'you@example.com');
  const password = await ask('Admin password (min 8 chars)', 'change-me-now');
  if (password.length < 8) {
    console.log('Password too short — skipped. Run `node scripts/create-admin.js` later.');
  } else {
    execSync(`node scripts/create-admin.js "${email}" "${password.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Setup complete!');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Run        : npm run dev');
console.log('  Open       : http://localhost:' + (process.env.PORT || 3000));
console.log('  Admin panel: /admin.html');
console.log('  Member demo: demo+sarah@example.test / demo-pass-1234');
console.log('  Tests      : npm test');
console.log('═══════════════════════════════════════════════════════════\n');

rl.close();
