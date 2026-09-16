import { getBrand, getTheme } from './brand.js';

function renderShell({ subject, preheader, bodyHtml }) {
  const b = getBrand();
  const t = getTheme();
  const c = t.colors || {};
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bone || '#F7F4EE'};font-family:Helvetica,Arial,sans-serif;color:${c.ink || '#0E0F12'};">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escape(preheader || '')}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${c.bone || '#F7F4EE'};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(14,15,18,.08);">
        <tr>
          <td style="background:${c.ink || '#0E0F12'};padding:24px 32px;color:${c.bone || '#F7F4EE'};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background:${c.gold || '#C9A24B'};color:${c.ink || '#0E0F12'};font-family:'Anton','Arial Black',sans-serif;font-size:22px;font-weight:900;width:36px;height:36px;border-radius:6px;text-align:center;vertical-align:middle;">${escape(b.shortName?.[0] || 'F')}</td>
                <td style="padding-left:12px;font-family:'Anton','Arial Black',sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:18px;">
                  ${escape(b.name)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:16px;line-height:1.6;color:${c.ink || '#0E0F12'};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:${c.bone || '#F7F4EE'};border-top:1px solid ${c.line || '#E6E2D8'};font-size:12px;color:${c.mute || '#6C707A'};line-height:1.6;">
            <strong style="color:${c.ink || '#0E0F12'};">${escape(b.name)}</strong><br>
            ${escape(b.address?.street || '')} · ${escape(b.address?.city || '')} ${escape(b.address?.postcode || '')}<br>
            <a href="tel:${escape(b.phoneTel || '')}" style="color:${c.mute || '#6C707A'};">${escape(b.phoneDisplay || '')}</a> ·
            <a href="mailto:${escape(b.email || '')}" style="color:${c.mute || '#6C707A'};">${escape(b.email || '')}</a><br>
            <a href="${escape(b.url || '')}" style="color:${c.blood || '#C8102E'};">${escape(b.url?.replace(/^https?:\/\//, '') || '')}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function btn(label, href) {
  const t = getTheme().colors || {};
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td>
    <a href="${escape(href)}" style="display:inline-block;background:${t.blood || '#C8102E'};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:13px;">${escape(label)}</a>
  </td></tr></table>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────

export function leadConfirmation(lead) {
  const b = getBrand();
  const html = renderShell({
    subject: `Your free trial at ${b.shortName} is confirmed`,
    preheader: `See you on the mat — here's what to bring.`,
    bodyHtml: `
      <h1 style="font-family:'Anton','Arial Black',sans-serif;font-size:32px;letter-spacing:.02em;text-transform:uppercase;margin:0 0 8px;">Welcome, ${escape(lead.first_name || lead.firstName)}.</h1>
      <p style="margin:0 0 16px;color:#6C707A;">A coach will reply within 60 minutes to confirm your slot for <strong style="color:#0E0F12;">${escape(lead.program || 'your chosen class')}</strong>.</p>
      <hr style="border:0;border-top:1px solid #E6E2D8;margin:24px 0;">
      <p style="margin:0 0 8px;font-weight:700;">What to bring</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#2A2D34;">
        <li>Comfortable workout clothes (no zips)</li>
        <li>Water bottle and a small towel</li>
        <li>Yourself, 10 minutes early — we'll lend you the kit</li>
      </ul>
      <p style="margin:0 0 8px;font-weight:700;">Where to go</p>
      <p style="margin:0 0 16px;color:#2A2D34;">${escape(b.address?.street || '')}<br>${escape(b.address?.city || '')} ${escape(b.address?.postcode || '')}</p>
      <p style="margin:0 0 24px;">Need to change your slot or have a question? Reply to this email or call <a href="tel:${escape(b.phoneTel || '')}" style="color:#C8102E;">${escape(b.phoneDisplay || '')}</a>.</p>
      ${btn('Open Class Schedule', `${b.url}/schedule.html`)}
    `,
  });
  return {
    subject: `Your free trial at ${b.shortName} — confirmed`,
    html,
    text: `Welcome, ${lead.first_name || lead.firstName}!\n\nA coach will reply within 60 minutes to confirm your slot for "${lead.program || 'your chosen class'}".\n\nWhat to bring: comfy kit, water, 10 minutes early. We lend the rest.\nWhere: ${b.address?.street || ''}, ${b.address?.city || ''} ${b.address?.postcode || ''}\nQuestions? ${b.phoneDisplay || ''} or reply to this email.\n\n— ${b.name}\n${b.url}`,
  };
}

export function leadOwnerNotification(lead) {
  const b = getBrand();
  const lines = [
    ['Name',        `${lead.first_name} ${lead.last_name || ''}`.trim()],
    ['Email',       lead.email],
    ['Phone',       lead.phone || '—'],
    ['Program',     lead.program || '—'],
    ['Day / Time',  `${lead.preferred_day || '—'} / ${lead.preferred_time || '—'}`],
    ['Experience',  lead.experience || '—'],
    ['Hear about',  lead.hear_about || '—'],
    ['Referrer',    lead.referrer || '—'],
    ['Notes',       lead.notes || '—'],
  ];
  const rows = lines.map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6C707A;font-size:13px;text-transform:uppercase;letter-spacing:.1em;width:120px;">${escape(k)}</td><td style="padding:6px 0;font-size:15px;">${escape(v)}</td></tr>`
  ).join('');
  const html = renderShell({
    subject: `New lead — ${lead.first_name} ${lead.last_name || ''}`.trim(),
    preheader: `${lead.email} · ${lead.program || ''}`,
    bodyHtml: `
      <h1 style="font-family:'Anton','Arial Black',sans-serif;font-size:24px;text-transform:uppercase;margin:0 0 16px;">New lead</h1>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">${rows}</table>
      <hr style="border:0;border-top:1px solid #E6E2D8;margin:24px 0;">
      <p style="margin:0;">Reply directly to this email to contact them.</p>
    `,
  });
  return {
    subject: `New trial booking — ${lead.first_name} ${lead.last_name || ''}`.trim(),
    html,
    text: `New lead from ${b.url}\n\n` + lines.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nReply to this email to contact them.`,
  };
}

export function passwordResetEmail(member, link) {
  const html = renderShell({
    subject: 'Reset your password',
    preheader: 'Set a new password — link valid for 60 minutes.',
    bodyHtml: `
      <h1 style="font-family:'Anton','Arial Black',sans-serif;font-size:28px;text-transform:uppercase;margin:0 0 12px;">Reset your password</h1>
      <p style="margin:0 0 16px;">Someone (hopefully you) asked to reset your password. Open the button below to choose a new one — the link is valid for <strong>60 minutes</strong>.</p>
      ${btn('Set New Password', link)}
      <p style="margin:24px 0 0;color:#6C707A;font-size:13px;">If you didn't ask for this, you can safely ignore this email — your password is unchanged.</p>
    `,
  });
  return { subject: `Reset your ${getBrand().shortName} password`, html, text: `Open this link to reset your password (valid 60 minutes):\n\n${link}\n\nIf you didn't ask for this, ignore — your password is unchanged.` };
}

export function emailVerificationEmail(member, link) {
  const html = renderShell({
    subject: 'Verify your email',
    preheader: 'One click to confirm your account.',
    bodyHtml: `
      <h1 style="font-family:'Anton','Arial Black',sans-serif;font-size:28px;text-transform:uppercase;margin:0 0 12px;">Welcome${member.first_name ? ', ' + escape(member.first_name) : ''}.</h1>
      <p style="margin:0 0 16px;">Confirm your email to unlock everything in your member portal. The link is valid for 24 hours.</p>
      ${btn('Verify My Email', link)}
      <p style="margin:24px 0 0;color:#6C707A;font-size:13px;">If you didn't sign up, ignore this email — no account will be created.</p>
    `,
  });
  return { subject: `Verify your ${getBrand().shortName} account`, html, text: `Open this link to verify your email (valid 24 hours):\n\n${link}` };
}
