import nodemailer from 'nodemailer';

let _transporter = null;

export function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  } else {
    // Dev / preview: log emails to stdout instead of sending
    _transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }
  return _transporter;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const t = getTransporter();
  const from = process.env.EMAIL_FROM || 'Forge Manchester <hello@forgemartialarts.co.uk>';
  const info = await t.sendMail({ from, to, subject, html, text, replyTo });
  if (!process.env.SMTP_HOST) {
    // eslint-disable-next-line no-console
    console.log('\n────── DEV EMAIL ──────');
    // eslint-disable-next-line no-console
    console.log(`To:      ${to}\nSubject: ${subject}\n\n${text || html}`);
    // eslint-disable-next-line no-console
    console.log('────────────────────────\n');
  }
  return info;
}

export function leadNotificationEmail(lead) {
  const lines = [
    `New lead from forgemartialarts.co.uk`,
    ``,
    `Name:        ${lead.first_name} ${lead.last_name || ''}`,
    `Email:       ${lead.email}`,
    `Phone:       ${lead.phone || '—'}`,
    `Program:     ${lead.program || '—'}`,
    `Day / Time:  ${lead.preferred_day || '—'} / ${lead.preferred_time || '—'}`,
    `Experience:  ${lead.experience || '—'}`,
    `Hear about:  ${lead.hear_about || '—'}`,
    `Referrer:    ${lead.referrer || '—'}`,
    `Notes:       ${lead.notes || '—'}`,
    ``,
    `Reply directly to this email to contact them.`,
  ].join('\n');
  return { subject: `New trial booking — ${lead.first_name} ${lead.last_name || ''}`.trim(), text: lines };
}

export function leadConfirmationEmail(lead) {
  const text = [
    `Hi ${lead.first_name},`,
    ``,
    `Thanks for booking a free trial at Forge Martial Arts Manchester.`,
    `A coach will reply within 60 minutes to confirm your slot for "${lead.program || 'your chosen class'}".`,
    ``,
    `What to bring: comfortable kit, a water bottle. We lend you everything else.`,
    `When to arrive: 10 minutes early.`,
    `Where: Unit 4, Dale Street, Manchester M1 1JW.`,
    ``,
    `If anything changes — call 0161 200 0000 or reply to this email.`,
    ``,
    `See you on the mat,`,
    `Forge Manchester`,
  ].join('\n');
  return { subject: 'Your free trial at Forge Manchester — confirmed', text };
}
