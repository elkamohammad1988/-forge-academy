/* Push notifications to chat platforms when new leads land.
   Configure via env: NOTIFY_SLACK_WEBHOOK / NOTIFY_DISCORD_WEBHOOK / NOTIFY_TELEGRAM_BOT_TOKEN + NOTIFY_TELEGRAM_CHAT_ID
   All channels are optional and fire-and-forget — failures never bubble up.
*/

async function postJSON(url, body) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('notify: failed to POST', url, e.message);
  }
}

export async function notifyNewLead(lead) {
  const tasks = [];
  const summary =
    `🥋 *New lead* at Forge Manchester\n` +
    `*${lead.first_name} ${lead.last_name || ''}* — ${lead.program || 'unspecified'}\n` +
    `📧 ${lead.email}` + (lead.phone ? ` · 📞 ${lead.phone}` : '') + '\n' +
    (lead.notes ? `_${lead.notes.slice(0, 200)}_` : '');

  if (process.env.NOTIFY_SLACK_WEBHOOK) {
    tasks.push(postJSON(process.env.NOTIFY_SLACK_WEBHOOK, {
      text: summary,
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: summary },
      }],
    }));
  }

  if (process.env.NOTIFY_DISCORD_WEBHOOK) {
    tasks.push(postJSON(process.env.NOTIFY_DISCORD_WEBHOOK, {
      username: 'Forge Bot',
      content: summary.replace(/\*/g, '**'),
    }));
  }

  if (process.env.NOTIFY_TELEGRAM_BOT_TOKEN && process.env.NOTIFY_TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${process.env.NOTIFY_TELEGRAM_BOT_TOKEN}/sendMessage`;
    tasks.push(postJSON(url, {
      chat_id: process.env.NOTIFY_TELEGRAM_CHAT_ID,
      text: summary.replace(/\*([^*]+)\*/g, '*$1*'),
      parse_mode: 'Markdown',
    }));
  }

  if (process.env.NOTIFY_GENERIC_WEBHOOK) {
    tasks.push(postJSON(process.env.NOTIFY_GENERIC_WEBHOOK, { type: 'lead.created', lead }));
  }

  await Promise.allSettled(tasks);
}
