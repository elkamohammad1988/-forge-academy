import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
const phone = z.string().trim().max(40).regex(/^[+\d\s().-]{6,40}$/, 'Invalid phone').optional().or(z.literal(''));
const name  = z.string().trim().min(1).max(80);

export const leadSchema = z.object({
  firstName:    name,
  lastName:     name.optional().or(z.literal('')),
  email,
  phone:        phone.optional(),
  age:          z.string().max(40).optional().or(z.literal('')),
  experience:   z.string().max(80).optional().or(z.literal('')),
  program:      z.string().max(80).optional().or(z.literal('')),
  preferredDay: z.string().max(20).optional().or(z.literal('')),
  preferredTime:z.string().max(40).optional().or(z.literal('')),
  hearAbout:    z.string().max(80).optional().or(z.literal('')),
  notes:        z.string().max(2000).optional().or(z.literal('')),
  consent:      z.union([z.boolean(), z.literal('on'), z.literal('true')]).optional(),
  referrer:     z.string().max(200).optional().or(z.literal('')),
  // Anti-bot
  // Honeypot — bots fill this; the route silently drops (200, id:0). Accept
  // any value so the bot doesn't see a 422 and learn to skip the field.
  website:      z.string().max(2000).optional().or(z.literal('')),
  _ts:          z.coerce.number().optional(),
});

export const contactSchema = z.object({
  firstName: name,
  email,
  phone:     phone.optional(),
  topic:     z.string().max(80).optional().or(z.literal('')),
  message:   z.string().trim().min(2).max(5000),
  consent:   z.union([z.boolean(), z.literal('on'), z.literal('true')]).optional(),
  referrer:  z.string().max(200).optional().or(z.literal('')),
  website:   z.string().max(2000).optional().or(z.literal('')),
  _ts:       z.coerce.number().optional(),
});

export const newsletterSchema = z.object({
  email,
  website: z.string().max(2000).optional().or(z.literal('')),
  _ts:     z.coerce.number().optional(),
});

export const registerSchema = z.object({
  firstName: name,
  lastName:  name.optional().or(z.literal('')),
  email,
  password:  z.string().min(8).max(128),
  consent:   z.union([z.boolean(), z.literal('on'), z.literal('true')]),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const checkoutSchema = z.object({
  plan:   z.enum(['kids', 'unlimited', 'family']),
  period: z.enum(['monthly', 'annual']).default('monthly'),
  email:  email.optional(),
});

export const bookingSchema = z.object({
  classDay:  z.coerce.number().int().min(0).max(6),
  classTime: z.string().regex(/^\d{2}:\d{2}$/),
  program:   z.string().min(1).max(40),
});

export function ageOk(_ts) {
  if (!_ts) return true;            // tolerate missing on legacy clients
  const delta = Date.now() - Number(_ts);
  return delta >= 2500 && delta < 24 * 3600 * 1000;
}
