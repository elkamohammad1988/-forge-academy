/* iCal/ICS feed of the public class schedule. Subscribers get an always-fresh
   read-only calendar in Google Calendar, Apple Calendar, Outlook, etc.
   Generates events for the next 8 weeks based on the current weekly template.
*/
import { Router } from 'express';
import { loadSchedule } from '../data/load-schedule.js';
import { getBrand } from '../lib/brand.js';

const router = Router();

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtUTC(d) {
  return d.getUTCFullYear()
    + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}
function escape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

router.get('/forge.ics', (_req, res) => {
  const b = getBrand();
  // loadSchedule returns rows with `dur`; iCal previously expected `duration` —
  // normalise here so we don't need to remember in two places.
  const SCHED = loadSchedule().map((c) => ({ ...c, duration: c.duration ?? c.dur ?? 60 }));

  const PROG_LABEL = { BJJ: 'Brazilian Jiu-Jitsu', MuayThai: 'Muay Thai', Boxing: 'Boxing', Kids: 'Kids Karate' };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//' + (b.shortName || 'Forge') + '//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + escape(b.name + ' — Class Schedule'),
    'X-WR-TIMEZONE:Europe/London',
    'X-WR-CALDESC:' + escape('All classes at ' + b.name + '. Subscribe to keep your calendar in sync.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
  ];

  // Emit 8 weeks of events
  for (let week = 0; week < 8; week++) {
    for (const c of SCHED) {
      const d = new Date(start);
      const offset = ((c.day - d.getDay()) + 7) % 7 + week * 7;
      d.setDate(d.getDate() + offset);
      const [h, m] = c.time.split(':').map(Number);
      const startAt = new Date(d); startAt.setHours(h, m, 0, 0);
      const endAt   = new Date(startAt.getTime() + (c.duration || 60) * 60_000);
      const uid = `forge-${c.day}-${c.time}-${week}-${c.prog}@${(b.url || '').replace(/^https?:\/\//, '')}`;

      out.push('BEGIN:VEVENT');
      out.push('UID:' + uid);
      out.push('DTSTAMP:' + fmtUTC(new Date()));
      out.push('DTSTART:' + fmtUTC(startAt));
      out.push('DTEND:'   + fmtUTC(endAt));
      out.push('SUMMARY:' + escape((c.title || PROG_LABEL[c.prog] || c.prog) + ' · ' + (c.coach || '')));
      out.push('LOCATION:' + escape(`${b.name}, ${b.address?.street || ''}, ${b.address?.city || ''} ${b.address?.postcode || ''}`));
      out.push('DESCRIPTION:' + escape(`${PROG_LABEL[c.prog] || c.prog} · ${c.level || 'All levels'} · book at ${b.url}/booking.html`));
      out.push('CATEGORIES:' + escape(PROG_LABEL[c.prog] || c.prog));
      out.push('URL:' + (b.url || '') + '/schedule.html');
      out.push('END:VEVENT');
    }
  }

  out.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Disposition', 'inline; filename="forge-schedule.ics"');
  res.send(out.join('\r\n'));
});

export default router;
