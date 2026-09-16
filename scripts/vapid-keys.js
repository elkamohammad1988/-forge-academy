#!/usr/bin/env node
/* Generate a VAPID key pair for web-push.
   Usage:  node scripts/vapid-keys.js
   Copy the output into VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env.
*/
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\nVAPID keys generated. Add these to .env:\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\nKeep the private key secret. The public key is safe to expose.\n');
