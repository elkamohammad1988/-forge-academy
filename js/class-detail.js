/* Class detail page renderer.
   Reads ?day=&time= from the URL, fetches the schedule via forgeAPI,
   finds the matching session, and renders the booking detail card.
   Lives in an external file so HTML auto-formatters don't shred the
   inline template strings. */
(function () {
  'use strict';

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var PROG_LABEL = { BJJ: 'Brazilian Jiu-Jitsu', MuayThai: 'Muay Thai', Boxing: 'Boxing', Kids: 'Kids Karate' };
  var PROG_HREF  = { BJJ: 'programs/bjj.html',   MuayThai: 'programs/muay-thai.html', Boxing: 'programs/boxing.html', Kids: 'programs/kids.html' };

  function esc(s) {
    var entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return entities[c]; });
  }

  var p = new URLSearchParams(location.search);
  var day = parseInt(p.get('day'), 10);
  var time = p.get('time');
  var detailHost = document.getElementById('classDetail');
  var host = detailHost && detailHost.querySelector('.container');
  if (!host) return;

  function fallback(msg) {
    host.innerHTML =
      '<p class="text-secondary">' + msg +
      ' <a href="schedule.html" class="text-blood fw-bold">Browse all classes →</a></p>';
  }

  function init() {
    if (!window.forgeAPI) { setTimeout(init, 100); return; }
    if (!isFinite(day) || !time) { fallback('Invalid class.'); return; }
    window.forgeAPI.schedule()
      .then(function (r) {
        var c = (r.schedule || []).find(function (x) { return x.day === day && x.time === time; });
        if (!c) { fallback('Class not found.'); return; }
        render(c);
      })
      .catch(function () { fallback('Could not load schedule.'); });
  }

  function render(c) {
    var label = PROG_LABEL[c.prog] || c.prog;
    var href  = PROG_HREF[c.prog] || 'schedule.html';
    var pct   = Math.min(100, Math.round((c.booked / Math.max(1, c.capacity)) * 100));
    var fillCls = pct >= 100 ? 'full' : (pct >= 80 ? 'tight' : '');
    var capCls  = pct >= 100 ? 'cap-label-full' : (pct >= 80 ? 'cap-label-tight' : 'text-secondary');
    var spotsLabel = pct >= 100
      ? 'Full · waitlist available'
      : (c.spots_left + ' of ' + c.capacity + ' spots open');

    var startsAt = c.starts_at ? new Date(c.starts_at) : null;
    var startsLabel = startsAt
      ? startsAt.toLocaleString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
        })
      : DAYS[c.day] + ' at ' + c.time;

    var bookHref = 'booking.html?program=' + encodeURIComponent(label) +
                   '&day=' + DAYS[c.day] + '&time=' + c.time;
    var ctaLabel = pct >= 100 ? 'Join Waitlist' : 'Book This Class';

    var parts = [];
    parts.push('<span class="eyebrow">' + esc(label) + ' · ' + esc(c.level || 'All levels') + '</span>');
    parts.push('<h1>' + esc(c.title || label) + '</h1>');
    parts.push('<p class="text-secondary lead">' + esc(startsLabel) + ' · with ' + esc(c.coach || 'a Forge coach') + ' · ' + esc(c.dur || 60) + ' minutes.</p>');

    parts.push('<div class="lead-wrap light mt-4">');

    parts.push('<div class="d-flex gap-2 flex-wrap justify-content-between align-items-end mb-3">');
    parts.push('<div><strong style="font-family:var(--f-display); font-size:1.5rem;">' + esc(c.booked) + ' / ' + esc(c.capacity) + '</strong>');
    parts.push('<div class="text-secondary" style="font-size:.78rem; letter-spacing:.14em; text-transform:uppercase;">Booked</div></div>');
    parts.push('<span class="' + capCls + '" style="font-size:.85rem; font-weight:700;">' + esc(spotsLabel) + '</span>');
    parts.push('</div>');

    parts.push('<div class="cap-bar-track" style="width:100%; height:10px;"><span class="cap-bar-fill ' + fillCls + '" style="width:' + pct + '%;"></span></div>');

    parts.push('<hr class="divider">');

    parts.push('<h3 style="font-size:1.15rem;">What to expect</h3>');
    parts.push('<p class="text-secondary">A 60-minute structured session: 10 minutes warm-up, 35 minutes technique &amp; drills, 15 minutes cool-down or controlled rounds. Beginners welcome — coach will pair you with the right partner.</p>');

    parts.push('<h3 style="font-size:1.15rem;">What to bring</h3>');
    parts.push('<ul style="color: var(--c-charcoal);">');
    parts.push('<li>Comfortable workout clothes (no zips for grappling classes)</li>');
    parts.push('<li>Water bottle and small towel</li>');
    parts.push('<li>Yourself, 10 minutes early — we lend the rest</li>');
    parts.push('</ul>');

    parts.push('<div class="d-flex gap-2 flex-wrap mt-4">');
    parts.push('<a href="' + bookHref + '" class="btn-forge btn-primary-forge btn-arrow">' + ctaLabel + '</a>');
    parts.push('<a href="' + href + '" class="btn-forge btn-dark-forge">All ' + esc(label) + ' info</a>');
    parts.push('<a href="schedule.html" class="btn-forge btn-ghost-forge" style="color: var(--c-ink); border-color: var(--c-line);">Back to schedule</a>');
    parts.push('</div>');

    parts.push('</div>');

    host.innerHTML = parts.join('');
  }

  init();
})();
