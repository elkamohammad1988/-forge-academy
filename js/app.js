/* =========================================================
   Forge Martial Arts Academy — production runtime
   Vanilla JS, zero deps, no build step.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };
  var on = function (el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); };
  var qs = function (k) {
    var m = location.search.match(new RegExp('[?&]' + k + '=([^&]+)'));
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  };
  var safeJSON = function (s, fb) { try { return JSON.parse(s); } catch (e) { return fb; } };

  // HTML-escape — used whenever we build markup from data, even if data is
  // currently static. Defence-in-depth against future regressions.
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ---------- 1. FAQ accordion ---------- */
  $$('.faq-q').forEach(function (btn) {
    on(btn, 'click', function () {
      var item = btn.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      $$('.faq-item.open').forEach(function (el) {
        if (el !== item) {
          el.classList.remove('open');
          var b = $('.faq-q', el); if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* ---------- 2. Smooth-scroll ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    on(a, 'click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2 || id === '#!' || a.hasAttribute('data-open-modal')) return;
      var target = $(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top: top, behavior: 'smooth' });
      closeDrawer();
    });
  });

  /* ---------- 3. Header shadow + scroll progress + back-to-top ---------- */
  var header   = $('.site-header');
  var progress = $('.scroll-progress');
  var backTop  = $('.back-to-top');

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';
    }
    if (backTop) backTop.classList.toggle('visible', y > 600);
  }
  on(window, 'scroll', onScroll, { passive: true });
  onScroll();

  if (backTop) on(backTop, 'click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- 4. Mobile drawer ---------- */
  var drawer    = $('.mobile-drawer');
  var navToggle = $('.nav-toggle');
  function openDrawer()  {
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.classList.add('no-scroll');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.classList.remove('no-scroll');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle) on(navToggle, 'click', function () {
    var open = navToggle.getAttribute('aria-expanded') === 'true';
    if (open) closeDrawer(); else openDrawer();
  });
  if (drawer) on(drawer, 'click', function (e) { if (e.target === drawer) closeDrawer(); });

  on(document, 'keydown', function (e) {
    if (e.key === 'Escape') { closeDrawer(); closeAllModals(); }
  });

  /* ---------- 5. Modals ---------- */
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    document.body.classList.add('no-scroll');
    var first = m.querySelector('button, a, input, select, textarea');
    if (first) first.focus();
  }
  function closeAllModals() {
    $$('.fmodal.open').forEach(function (m) { m.classList.remove('open'); });
    if (!drawer || !drawer.classList.contains('open')) {
      document.body.classList.remove('no-scroll');
    }
  }
  $$('[data-open-modal]').forEach(function (a) {
    on(a, 'click', function (e) { e.preventDefault(); openModal(a.getAttribute('data-open-modal')); });
  });
  $$('.fmodal').forEach(function (m) {
    on(m, 'click', function (e) { if (e.target === m) closeAllModals(); });
  });
  $$('.fmodal-close').forEach(function (b) { on(b, 'click', closeAllModals); });

  /* ---------- 6. Toasts ---------- */
  var toastStack = $('.toast-stack');
  function ensureToastStack() {
    if (toastStack) return toastStack;
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    toastStack.setAttribute('aria-live', 'polite');
    toastStack.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastStack);
    return toastStack;
  }
  function toast(msg, kind) {
    var stack = ensureToastStack();
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 3500);
  }
  window.forgeToast = toast; // expose for pages that want to surface success

  /* ---------- 7. Form validation + submit ---------- */
  var DRAFT_KEY = 'forge_form_draft_v1';

  function validateField(field) {
    var wrap = field.closest('.field-wrap') || field.parentNode;
    var val  = (field.value || '').trim();
    var err  = '';

    if (field.required && !val) err = 'This field is required.';
    else if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val))
      err = 'Please enter a valid email address.';
    else if (field.type === 'tel' && val && val.replace(/\D/g, '').length < 9)
      err = 'Please enter a valid phone number.';
    else if (field.tagName === 'SELECT' && field.required && !val)
      err = 'Please choose an option.';

    var msgEl = wrap && wrap.querySelector('.field-error');
    if (err) {
      if (wrap) { wrap.classList.add('invalid'); wrap.classList.remove('valid'); }
      if (msgEl) msgEl.textContent = err;
      return false;
    }
    if (wrap) { wrap.classList.remove('invalid'); if (val) wrap.classList.add('valid'); }
    return true;
  }

  function formatUKPhone(input) { input.value = input.value.replace(/[^0-9+ ]/g, ''); }

  function readForm(form) {
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    // checkboxes that aren't checked don't appear in FormData — record their state too
    $$('input[type="checkbox"]', form).forEach(function (c) { data[c.name || c.id] = c.checked; });
    return data;
  }

  function saveDraft(form) {
    try {
      var all = safeJSON(localStorage.getItem(DRAFT_KEY), {}) || {};
      all[form.dataset.formId || 'default'] = readForm(form);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
    } catch (e) { /* private mode etc. */ }
  }

  function restoreDraft(form) {
    try {
      var all = safeJSON(localStorage.getItem(DRAFT_KEY), {}) || {};
      var d = all[form.dataset.formId || 'default'];
      if (!d) return;
      Object.keys(d).forEach(function (k) {
        var f = form.elements[k];
        if (!f) return;
        if (f.type === 'checkbox') f.checked = !!d[k];
        else f.value = d[k];
      });
      var notice = form.querySelector('[data-draft-notice]');
      if (notice) notice.classList.add('visible');
    } catch (e) { /* ignore */ }
  }

  function clearDraft(form) {
    try {
      var all = safeJSON(localStorage.getItem(DRAFT_KEY), {}) || {};
      delete all[form.dataset.formId || 'default'];
      localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
    } catch (e) { /* ignore */ }
  }

  // Inject anti-bot fields into every Forge form: a honeypot and a render
  // timestamp. Honeypot is hidden visually + from assistive tech but bots
  // tend to fill it. Timestamp catches "instant" submissions.
  function fortifyForm(form) {
    if (form.querySelector('input[name="website"][data-honey]')) return;
    var honey = document.createElement('div');
    honey.setAttribute('aria-hidden', 'true');
    honey.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
    honey.innerHTML = '<label>Website (leave blank)<input type="text" name="website" tabindex="-1" autocomplete="off" data-honey></label>';
    form.appendChild(honey);

    var ts = document.createElement('input');
    ts.type = 'hidden';
    ts.name = '_ts';
    ts.value = String(Date.now());
    ts.setAttribute('data-ts', '');
    form.appendChild(ts);
  }
  function passesAntiBot(form) {
    var honey = form.querySelector('input[data-honey]');
    if (honey && honey.value) return false;
    var ts = form.querySelector('input[data-ts]');
    if (ts) {
      var rendered = parseInt(ts.value, 10);
      if (isFinite(rendered) && (Date.now() - rendered) < 2500) return false;
    }
    return true;
  }

  $$('form[data-forge-form]').forEach(function (form) {
    fortifyForm(form);
    restoreDraft(form);

    $$('input, select, textarea', form).forEach(function (field) {
      on(field, 'blur', function () { validateField(field); });
      on(field, 'input', function () {
        var wrap = field.closest('.field-wrap');
        if (wrap && wrap.classList.contains('invalid')) validateField(field);
        saveDraft(form);
      });
      on(field, 'change', function () { saveDraft(form); });
      if (field.type === 'tel') on(field, 'input', function () { formatUKPhone(field); });
    });

    var clearBtn = form.querySelector('[data-clear-draft]');
    if (clearBtn) on(clearBtn, 'click', function (e) {
      e.preventDefault();
      form.reset();
      clearDraft(form);
      var notice = form.querySelector('[data-draft-notice]');
      if (notice) notice.classList.remove('visible');
      toast('Draft cleared.', 'success');
    });

    on(form, 'submit', function (e) {
      e.preventDefault();

      if (!passesAntiBot(form)) {
        // Silently drop — don't reveal the trap. Looks like success to a bot.
        toast('Submitted.', 'success');
        return;
      }

      var fields = $$('input, select, textarea', form).filter(function (f) {
        return f.required || f.value;
      });
      var firstInvalid = null;
      var allValid = true;
      fields.forEach(function (f) {
        var ok = validateField(f);
        if (!ok && !firstInvalid) firstInvalid = f;
        if (!ok) allValid = false;
      });

      var consent = $('input[type="checkbox"][required]', form);
      if (consent && !consent.checked) {
        toast('Please accept the contact consent to continue.', 'warning');
        consent.focus();
        allValid = false;
      }

      if (!allValid) {
        if (firstInvalid) firstInvalid.focus();
        toast('Please fix the highlighted fields.', 'warning');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.classList.add('is-loading');
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Sending…';
      }

      var data = readForm(form);
      try { sessionStorage.setItem('forge_lead', JSON.stringify(data)); } catch (err) { /* ignore */ }

      var redirect = form.getAttribute('data-redirect') || 'thank-you.html';
      var formId   = form.dataset.formId || 'default';
      var apiPath;
      if (formId === 'contact')      apiPath = 'contact';
      else if (formId === 'newsletter') apiPath = 'subscribe';
      else                              apiPath = 'submitLead';

      function done() {
        clearDraft(form);
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'conversion', { 'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL' });
        }
        window.location.href = redirect;
      }
      function fail(msg) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.textContent = btn.dataset.originalText || 'Submit';
        }
        toast(msg || 'Something went wrong. Please call 0161 200 0000 if it persists.', 'warning');
      }

      // If the backend is reachable, use it. Otherwise fall back to a simulated
      // round-trip + redirect (preserves the static-only deployment path).
      var api = window.forgeAPI;
      if (api && api.isAvailable && api.isAvailable() && api[apiPath]) {
        api[apiPath](data).then(done).catch(function (err) {
          fail(err && err.data && err.data.error);
        });
      } else if (api && api.probe) {
        api.probe().then(function (ok) {
          if (ok && api[apiPath]) api[apiPath](data).then(done).catch(function (err) { fail(err && err.data && err.data.error); });
          else setTimeout(done, 650);
        });
      } else {
        setTimeout(done, 650);
      }
    });
  });

  /* ---------- 8. Reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('rise');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  }

  /* ---------- 9. Animated stat counters ---------- */
  function animateNumber(el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^([\d,\.]+)(.*)$/);
    if (!match) return;
    var target = parseFloat(match[1].replace(/,/g, ''));
    var suffix = match[2] || '';
    if (isNaN(target)) return;

    var startTime = null;
    var duration = 1400;

    function tick(ts) {
      if (!startTime) startTime = ts;
      var p = Math.min(1, (ts - startTime) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var current = target * eased;
      el.textContent = (target >= 100 ? Math.round(current).toLocaleString('en-GB') : current.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = raw;
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateNumber(entry.target); nio.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    $$('.stat-num').forEach(function (el) { nio.observe(el); });
  }

  /* ---------- 10. Personalise thank-you page ---------- */
  if (document.body && document.body.dataset.page === 'thank-you') {
    try {
      var lead = JSON.parse(sessionStorage.getItem('forge_lead') || '{}');
      // textContent already escapes, but constrain length defensively.
      var safeFirst = String(lead.firstName || '').slice(0, 60);
      var safeProg  = String(lead.program   || '').slice(0, 80);
      if (safeFirst) {
        var hook = document.querySelector('[data-greet]');
        if (hook) hook.textContent = 'Welcome to the academy, ' + safeFirst + '.';
      }
      var prog = document.querySelector('[data-program]');
      if (prog && safeProg) prog.textContent = safeProg;

      // Enable .ics calendar download with the user's chosen slot
      enableCalendarDownload(lead);
      enableShareButtons(lead);
    } catch (e) { /* ignore */ }
  }

  /* ---------- 11. Cookie consent ---------- */
  var COOKIE_KEY = 'forge_cookie_pref_v1';
  function getCookiePref() { return safeJSON(localStorage.getItem(COOKIE_KEY), null); }
  function saveCookiePref(p) {
    try { localStorage.setItem(COOKIE_KEY, JSON.stringify({ v: p, t: Date.now() })); } catch (e) {}
  }
  function buildCookieBanner() {
    if (getCookiePref()) return;
    var html = ''
      + '<div class="cookie-banner" role="region" aria-label="Cookie preferences">'
      + '  <div class="cookie-banner-inner">'
      + '    <div class="cookie-banner-text">'
      + '      <strong>We use minimal cookies.</strong>'
      + '      Essentials keep the site working. Analytics &amp; advertising help us improve and reach more new starters. You choose.'
      + '    </div>'
      + '    <div class="cookie-banner-actions">'
      + '      <button type="button" class="btn-forge btn-ghost-light" data-cookie-action="reject">Reject all</button>'
      + '      <button type="button" class="btn-forge btn-dark-forge" data-cookie-action="settings">Settings</button>'
      + '      <button type="button" class="btn-forge btn-primary-forge" data-cookie-action="accept">Accept all</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var node = wrap.firstChild;
    document.body.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('open'); });

    on(node.querySelector('[data-cookie-action="accept"]'), 'click', function () {
      saveCookiePref({ essential: true, analytics: true, ads: true });
      node.classList.remove('open');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 250);
      toast('Thanks — preferences saved.', 'success');
    });
    on(node.querySelector('[data-cookie-action="reject"]'), 'click', function () {
      saveCookiePref({ essential: true, analytics: false, ads: false });
      node.classList.remove('open');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 250);
      toast('Only essential cookies will be used.', 'success');
    });
    on(node.querySelector('[data-cookie-action="settings"]'), 'click', function () {
      openModal('modalCookieSettings');
    });
  }

  // Cookie settings modal — wire toggles to persistence
  var cookieSettings = $('#modalCookieSettings');
  if (cookieSettings) {
    var anal = cookieSettings.querySelector('[data-cookie-toggle="analytics"]');
    var ads  = cookieSettings.querySelector('[data-cookie-toggle="ads"]');
    var prev = getCookiePref();
    if (prev && prev.v) {
      if (anal) anal.checked = !!prev.v.analytics;
      if (ads)  ads.checked  = !!prev.v.ads;
    }
    var save = cookieSettings.querySelector('[data-cookie-save]');
    if (save) on(save, 'click', function () {
      saveCookiePref({
        essential: true,
        analytics: anal ? !!anal.checked : false,
        ads:       ads  ? !!ads.checked  : false
      });
      closeAllModals();
      toast('Cookie preferences saved.', 'success');
      var banner = $('.cookie-banner.open');
      if (banner) {
        banner.classList.remove('open');
        setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 250);
      }
    });
  }
  buildCookieBanner();

  // expose a way to re-open settings later (footer link)
  $$('[data-cookie-reopen]').forEach(function (el) {
    on(el, 'click', function (e) { e.preventDefault(); openModal('modalCookieSettings'); });
  });

  /* ---------- 12. Open-now indicator ---------- */
  // Mon-Fri 06:00-21:30, Sat 09:00-16:00, Sun 10:00-13:00
  var HOURS = [
    { d: 0, open: '10:00', close: '13:00' },
    { d: 1, open: '06:00', close: '21:30' },
    { d: 2, open: '06:00', close: '21:30' },
    { d: 3, open: '06:00', close: '21:30' },
    { d: 4, open: '06:00', close: '21:30' },
    { d: 5, open: '06:00', close: '21:30' },
    { d: 6, open: '09:00', close: '16:00' }
  ];
  function todayHours(now) {
    return HOURS.filter(function (h) { return h.d === now.getDay(); })[0];
  }
  function asMinutes(t) { var p = t.split(':'); return parseInt(p[0],10)*60 + parseInt(p[1],10); }
  function nowMinutes(d) { return d.getHours()*60 + d.getMinutes(); }
  function refreshOpenStatus() {
    var hosts = $$('[data-openstatus]');
    if (!hosts.length) return;
    var now = new Date();
    var h   = todayHours(now);
    var minutes = nowMinutes(now);
    var openTxt, openCls;
    if (h && minutes >= asMinutes(h.open) && minutes < asMinutes(h.close)) {
      openTxt = 'Open now · until ' + h.close;
      openCls = 'is-open';
    } else {
      // find next open day/time
      var probe = new Date(now);
      var found = null;
      for (var i = 0; i < 8; i++) {
        var ph = HOURS.filter(function (x) { return x.d === probe.getDay(); })[0];
        if (ph) {
          if (i === 0 && minutes < asMinutes(ph.open)) { found = { day: 'Today', time: ph.open }; break; }
          if (i > 0) {
            var dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][probe.getDay()];
            found = { day: i === 1 ? 'Tomorrow' : dn, time: ph.open };
            break;
          }
        }
        probe.setDate(probe.getDate() + 1);
      }
      openTxt = found ? 'Closed · opens ' + found.day + ' ' + found.time : 'Closed';
      openCls = 'is-closed';
    }
    hosts.forEach(function (host) {
      host.classList.remove('is-open', 'is-closed');
      host.classList.add(openCls);
      var dot = host.querySelector('.openstatus-dot');
      var txt = host.querySelector('.openstatus-text');
      if (txt) txt.textContent = openTxt;
      if (!dot && !txt) host.textContent = openTxt; // fallback
    });
  }
  refreshOpenStatus();
  setInterval(refreshOpenStatus, 60 * 1000);

  /* ---------- 13. Schedule page (filter + countdown) ---------- */
  // Class data — week template (24h times, durations in minutes)
  var SCHEDULE = [
    // Monday
    { day:1, time:'06:30', dur:60, prog:'BJJ',     level:'All',       coach:'Mateo S.',   title:'BJJ — Sunrise Open Mat' },
    { day:1, time:'12:15', dur:45, prog:'Boxing',  level:'All',       coach:'Lara H.',    title:'Boxing — Lunch Express' },
    { day:1, time:'18:00', dur:60, prog:'BJJ',     level:'Beginner',  coach:'Mateo S.',   title:'BJJ Fundamentals' },
    { day:1, time:'19:15', dur:60, prog:'MuayThai',level:'All',       coach:'Sasha P.',   title:'Muay Thai — Pads & Clinch' },
    // Tuesday
    { day:2, time:'06:30', dur:60, prog:'Boxing',  level:'All',       coach:'Lara H.',    title:'Boxing — Sunrise Sharp' },
    { day:2, time:'17:00', dur:55, prog:'Kids',    level:'5–10',      coach:'Tom F.',     title:'Kids Karate — Tigers' },
    { day:2, time:'18:00', dur:60, prog:'MuayThai',level:'Beginner',  coach:'Sasha P.',   title:'Muay Thai Fundamentals' },
    { day:2, time:'19:15', dur:75, prog:'BJJ',     level:'Advanced',  coach:'Carlos D.',  title:'BJJ — Advanced Sparring' },
    // Wednesday
    { day:3, time:'06:30', dur:60, prog:'BJJ',     level:'All',       coach:'Carlos D.',  title:'BJJ — Wake & Roll' },
    { day:3, time:'12:15', dur:45, prog:'MuayThai',level:'All',       coach:'Sasha P.',   title:'Muay Thai — Lunch HIIT' },
    { day:3, time:'18:00', dur:60, prog:'Boxing',  level:'Beginner',  coach:'Lara H.',    title:'Boxing Fundamentals' },
    { day:3, time:'19:15', dur:60, prog:'BJJ',     level:'All',       coach:'Mateo S.',   title:'BJJ — All Levels' },
    // Thursday
    { day:4, time:'06:30', dur:60, prog:'MuayThai',level:'All',       coach:'Sasha P.',   title:'Muay Thai — Sunrise Strike' },
    { day:4, time:'17:00', dur:55, prog:'Kids',    level:'11–14',     coach:'Tom F.',     title:'Kids Karate — Juniors' },
    { day:4, time:'18:00', dur:60, prog:'BJJ',     level:'Beginner',  coach:'Mateo S.',   title:'BJJ Fundamentals' },
    { day:4, time:'19:15', dur:60, prog:'Boxing',  level:'All',       coach:'Lara H.',    title:'Boxing — Pad Night' },
    // Friday
    { day:5, time:'06:30', dur:60, prog:'BJJ',     level:'All',       coach:'Carlos D.',  title:'BJJ — Friday Flow' },
    { day:5, time:'18:00', dur:60, prog:'MuayThai',level:'All',       coach:'Sasha P.',   title:'Muay Thai — Fight Night Tune-Up' },
    { day:5, time:'19:15', dur:90, prog:'BJJ',     level:'Advanced',  coach:'Carlos D.',  title:'BJJ — Open Mat & Drills' },
    // Saturday
    { day:6, time:'09:30', dur:75, prog:'BJJ',     level:'All',       coach:'Mateo S.',   title:'BJJ — Saturday Roll' },
    { day:6, time:'10:00', dur:55, prog:'Kids',    level:'5–14',      coach:'Tom F.',     title:'Kids Karate — Family Class' },
    { day:6, time:'11:30', dur:60, prog:'Boxing',  level:'All',       coach:'Lara H.',    title:'Boxing — Saturday Sparring' },
    { day:6, time:'12:45', dur:60, prog:'MuayThai',level:'All',       coach:'Sasha P.',   title:'Muay Thai — Conditioning' },
    // Sunday
    { day:0, time:'10:30', dur:60, prog:'BJJ',     level:'All',       coach:'Carlos D.',  title:'BJJ — Sunday Open Mat' },
    { day:0, time:'12:00', dur:50, prog:'MuayThai',level:'Beginner',  coach:'Sasha P.',   title:'Muay Thai — Beginner Drills' }
  ];
  window.FORGE_SCHEDULE = SCHEDULE;

  function progLabel(p) {
    return ({ BJJ:'Brazilian Jiu-Jitsu', MuayThai:'Muay Thai', Boxing:'Boxing', Kids:'Kids Karate' })[p] || p;
  }
  function progSlug(p) {
    return ({ BJJ:'bjj', MuayThai:'muay', Boxing:'boxing', Kids:'kids' })[p] || p.toLowerCase();
  }
  var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function renderSchedule() {
    var grid = $('#scheduleGrid');
    if (!grid) return;
    var prog = grid.dataset.filterProg || 'all';
    var day  = grid.dataset.filterDay  || 'all';
    var lvl  = grid.dataset.filterLevel|| 'all';

    var filtered = SCHEDULE.filter(function (c) {
      if (prog !== 'all' && c.prog !== prog) return false;
      if (day  !== 'all' && String(c.day) !== day) return false;
      if (lvl  !== 'all' && c.level.toLowerCase().indexOf(lvl) === -1) return false;
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="schedule-empty">No classes match those filters. Try widening your search.</div>';
      var c = $('#scheduleCount'); if (c) c.textContent = '0 classes';
      return;
    }

    // group by day
    var byDay = {};
    filtered.forEach(function (cls) { (byDay[cls.day] = byDay[cls.day] || []).push(cls); });
    Object.keys(byDay).forEach(function (k) {
      byDay[k].sort(function (a, b) { return a.time.localeCompare(b.time); });
    });

    // ordered Mon..Sun
    var order = [1,2,3,4,5,6,0];
    var html = '';
    order.forEach(function (d) {
      if (!byDay[d]) return;
      html += '<div class="schedule-day">';
      html += '  <div class="schedule-day-head">' + esc(DAY_NAMES[d]) + '</div>';
      html += '  <div class="schedule-rows">';
      byDay[d].forEach(function (cls) {
        var endMin = asMinutes(cls.time) + cls.dur;
        var endTime = pad2(Math.floor(endMin/60)) + ':' + pad2(endMin % 60);
        var slug = progSlug(cls.prog);
        var bookHref = 'booking.html?program=' + encodeURIComponent(progLabel(cls.prog)) +
                      '&day='  + encodeURIComponent(DAY_NAMES[cls.day]) +
                      '&time=' + encodeURIComponent(cls.time);

        // Capacity bar (uses backend-provided values when available, else defaults)
        var cap     = (typeof cls.capacity === 'number') ? cls.capacity : 20;
        var booked  = (typeof cls.booked   === 'number') ? cls.booked   : 0;
        var spots   = Math.max(0, cap - booked);
        var pct     = Math.min(100, Math.round((booked / Math.max(1, cap)) * 100));
        var fillCls = pct >= 100 ? 'full' : (pct >= 80 ? 'tight' : '');
        var lblCls  = pct >= 100 ? 'cap-label-full' : (pct >= 80 ? 'cap-label-tight' : '');
        var capLabel = pct >= 100 ? 'Full · join waitlist' : (spots + ' of ' + cap + ' left');
        var capHtml = '<span class="cap-bar"><span class="cap-bar-track"><span class="cap-bar-fill ' + fillCls + '" style="width:' + pct + '%;"></span></span><span class="' + lblCls + '">' + capLabel + '</span></span>';
        var ctaLabel = pct >= 100 ? 'Waitlist' : 'Book';

        var detailHref = 'class.html?day=' + cls.day + '&time=' + encodeURIComponent(cls.time);
        html += '<div class="schedule-row prog-' + esc(slug) + '">'
            +    '<a class="srow-time srow-link" href="' + esc(detailHref) + '"><strong>' + esc(cls.time) + '</strong><span>—' + esc(endTime) + '</span></a>'
            +    '<a class="srow-body srow-link" href="' + esc(detailHref) + '">'
            +      '<div class="srow-title">' + esc(cls.title) + '</div>'
            +      '<div class="srow-meta">'
            +        '<span class="chip chip-' + esc(slug) + '">' + esc(progLabel(cls.prog)) + '</span>'
            +        '<span>· ' + esc(cls.level) + ' · ' + esc(cls.coach) + '</span>'
            +      '</div>'
            +    '</a>'
            +    '<div class="srow-cap">' + capHtml + '</div>'
            +    '<a class="srow-cta" href="' + esc(bookHref) + '">' + ctaLabel + '</a>'
            +  '</div>';
      });
      html += '  </div>';
      html += '</div>';
    });
    grid.innerHTML = html;

    var count = $('#scheduleCount');
    if (count) count.textContent = filtered.length + ' class' + (filtered.length === 1 ? '' : 'es');
  }

  // Hydrate SCHEDULE with live capacity from /api/schedule when backend is up
  function hydrateSchedule() {
    var grid = $('#scheduleGrid');
    if (!grid || !window.forgeAPI) return;
    window.forgeAPI.probe().then(function (ok) {
      if (!ok) return;
      window.forgeAPI.schedule().then(function (r) {
        if (!r || !r.schedule) return;
        // Merge live values onto SCHEDULE in place
        r.schedule.forEach(function (s) {
          var match = SCHEDULE.find(function (c) { return c.day === s.day && c.time === s.time && c.prog === s.prog; });
          if (match) {
            match.capacity   = s.capacity;
            match.booked     = s.booked;
            match.spots_left = s.spots_left;
          }
        });
        renderSchedule();
      }).catch(function () {});
    });
  }

  function bindScheduleFilters() {
    var grid = $('#scheduleGrid');
    if (!grid) return;
    hydrateSchedule();
    $$('[data-filter-prog]').forEach(function (b) {
      on(b, 'click', function () {
        $$('[data-filter-prog]').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        grid.dataset.filterProg = b.dataset.filterProg;
        renderSchedule();
      });
    });
    $$('[data-filter-day]').forEach(function (b) {
      on(b, 'click', function () {
        $$('[data-filter-day]').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        grid.dataset.filterDay = b.dataset.filterDay;
        renderSchedule();
      });
    });
    $$('[data-filter-level]').forEach(function (b) {
      on(b, 'click', function () {
        $$('[data-filter-level]').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        grid.dataset.filterLevel = b.dataset.filterLevel;
        renderSchedule();
      });
    });
    renderSchedule();
  }
  bindScheduleFilters();

  /* ---------- 14. Next-class countdown banner ---------- */
  function nextClass(now) {
    // search forward up to 8 days
    var probe = new Date(now);
    for (var i = 0; i < 8; i++) {
      var d = probe.getDay();
      var classes = SCHEDULE.filter(function (c) { return c.day === d; })
        .sort(function (a, b) { return a.time.localeCompare(b.time); });
      for (var j = 0; j < classes.length; j++) {
        var startMin = asMinutes(classes[j].time);
        if (i === 0 && startMin <= nowMinutes(now)) continue;
        var when = new Date(probe);
        when.setHours(parseInt(classes[j].time.split(':')[0],10), parseInt(classes[j].time.split(':')[1],10), 0, 0);
        return { cls: classes[j], when: when };
      }
      probe.setDate(probe.getDate() + 1);
    }
    return null;
  }
  function fmtCountdown(ms) {
    if (ms <= 0) return 'starting now';
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d*86400;
    var h = Math.floor(s / 3600);  s -= h*3600;
    var m = Math.floor(s / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }
  function refreshNextClass() {
    var hosts = $$('[data-nextclass]');
    if (!hosts.length) return;
    var now = new Date();
    var next = nextClass(now);
    hosts.forEach(function (host) {
      if (!next) { host.style.display = 'none'; return; }
      var nameEl = host.querySelector('[data-nextclass-name]');
      var inEl   = host.querySelector('[data-nextclass-in]');
      var whenEl = host.querySelector('[data-nextclass-when]');
      var ctaEl  = host.querySelector('[data-nextclass-cta]');
      if (nameEl) nameEl.textContent = next.cls.title;
      if (inEl)   inEl.textContent   = fmtCountdown(next.when - now);
      if (whenEl) whenEl.textContent = DAY_NAMES[next.cls.day] + ' · ' + next.cls.time;
      if (ctaEl)  ctaEl.href = 'booking.html?program=' + encodeURIComponent(progLabel(next.cls.prog)) + '&day=' + DAY_NAMES[next.cls.day] + '&time=' + next.cls.time;
    });
  }
  refreshNextClass();
  setInterval(refreshNextClass, 30 * 1000);

  /* ---------- 14b. Hero "on the mat today" panel ----------
     Same SCHEDULE the timetable page uses — the hero shows real classes,
     not decoration. Stays hidden if there is nothing to show. */
  function renderTodayPanel() {
    var panel = $('[data-today-panel]');
    if (!panel) return;
    var list = panel.querySelector('[data-today-list]');
    var dateEl = panel.querySelector('[data-today-date]');
    if (!list) return;

    var now = new Date();
    var today = now.getDay();
    var mins = nowMinutes(now);
    var classes = SCHEDULE
      .filter(function (c) { return c.day === today; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    }

    if (!classes.length) {
      list.innerHTML = '<li class="hero-today-empty">No classes scheduled today. The mats are back tomorrow morning.</li>';
      panel.hidden = false;
      return;
    }

    // First class that has not started yet gets the accent rule; anything
    // already finished is dimmed so the panel reads as "now", not "a list".
    var nextIdx = classes.findIndex(function (c) { return asMinutes(c.time) > mins; });

    list.innerHTML = classes.map(function (c, i) {
      var done = asMinutes(c.time) + c.dur <= mins;
      var cls = i === nextIdx ? ' class="is-next"' : (done ? ' class="is-done"' : '');
      return '<li' + cls + '>'
        +   '<span class="hero-today-time">' + esc(c.time) + '</span>'
        +   '<span>'
        +     '<span class="hero-today-name">' + esc(c.title) + '</span>'
        +     '<span class="hero-today-meta">' + esc(c.coach) + ' · ' + esc(c.level) + ' · ' + c.dur + ' min</span>'
        +   '</span>'
        + '</li>';
    }).join('');

    // If everything today is done, say so rather than showing a dead list.
    if (nextIdx === -1) {
      list.insertAdjacentHTML('beforeend',
        '<li class="hero-today-empty">That’s today done. Next session is tomorrow morning.</li>');
    }

    panel.hidden = false;
  }
  renderTodayPanel();

  /* ---------- 15. Pricing toggle ---------- */
  var pricingToggle = $('[data-pricing-toggle]');
  if (pricingToggle) {
    on(pricingToggle, 'change', function () {
      var annual = pricingToggle.checked;
      $$('[data-price]').forEach(function (el) {
        el.textContent = annual ? el.dataset.priceAnnual : el.dataset.priceMonthly;
      });
      $$('[data-price-period]').forEach(function (el) {
        el.textContent = annual ? '/yr' : '/mo';
      });
      $$('[data-price-save]').forEach(function (el) {
        el.style.display = annual ? '' : 'none';
      });
    });
  }

  /* ---------- 16. Coach modal (auto-built from card data) ---------- */
  var COACHES = {
    mateo: {
      name: 'Mateo Silva',
      title: 'Head BJJ Coach · 3rd-degree Black Belt',
      bio: 'Started in São Paulo at 6 years old. ADCC Europe medallist. Now 14 years coaching beginners — patient, technical, and famous for never raising his voice.',
      stats: ['18 yrs competing', 'IBJJF certified']
    },
    sasha: {
      name: 'Sasha Petrov',
      title: 'Head Muay Thai Coach · Kru certified',
      bio: 'Trained in Phuket under Master Yodtong. 22 fights pro across Thailand and the UK. Specialises in clinch work and structured beginner programmes.',
      stats: ['22 pro fights', 'Kru certified Bangkok', '8 yrs at Forge']
    },
    lara: {
      name: 'Lara Holloway',
      title: 'Head Boxing Coach · England Boxing L3',
      bio: 'Former GB amateur squad. Coaches everyone from total beginners to white-collar competitors. Pads, footwork, and tactical sparring her specialty.',
      stats: ['L3 certified', 'GB amateur squad alum', '9 yrs coaching']
    },
    carlos: {
      name: 'Carlos Diaz',
      title: 'Senior BJJ & MMA Coach · 2nd-degree Black Belt',
      bio: 'Brings the competition edge — ran the advanced sparring programme since 2019. Calm under pressure, ruthless drill designer, kindest hands in the gym.',
      stats: ['Black belt 2018', 'European silver 2022', 'S&C certified']
    },
    tom: {
      name: 'Tom Fielding',
      title: 'Head Kids Coach · Karate 4th Dan',
      bio: 'Twenty-five years in karate, eight running our kids programme. DBS-checked, Safeguarding L2, and a parent of two — he gets the nervous-first-class jitters.',
      stats: ['4th Dan Shotokan', 'DBS + Safeguarding L2']
    }
  };
  $$('[data-coach]').forEach(function (card) {
    on(card, 'click', function () { openCoachModal(card.dataset.coach); });
    on(card, 'keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCoachModal(card.dataset.coach); }
    });
  });
  function openCoachModal(key) {
    var c = COACHES[key];
    if (!c) return;
    var m = $('#modalCoach');
    if (!m) return;
    var body = m.querySelector('.fmodal-panel .coach-body');
    if (body) {
      var initials = c.name.split(' ').map(function (s) { return s.charAt(0); }).join('');
      body.innerHTML =
        '<div class="coach-avatar-lg">' + esc(initials) + '</div>' +
        '<h3>' + esc(c.name) + '</h3>' +
        '<div class="coach-title">' + esc(c.title) + '</div>' +
        '<p>' + esc(c.bio) + '</p>' +
        '<ul class="coach-stats">' + c.stats.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    }
    openModal('modalCoach');
  }

  /* ---------- 17. Newsletter ---------- */
  $$('form[data-newsletter]').forEach(function (form) {
    fortifyForm(form);
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (!passesAntiBot(form)) { toast('Subscribed.', 'success'); return; }
      var em = form.querySelector('input[type="email"]');
      if (!em) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) {
        toast('Please enter a valid email.', 'warning');
        em.focus();
        return;
      }
      var data = readForm(form);
      var api = window.forgeAPI;
      function localFallback() {
        try {
          var subs = safeJSON(localStorage.getItem('forge_newsletter'), []) || [];
          subs.push({ email: em.value.trim(), at: new Date().toISOString() });
          localStorage.setItem('forge_newsletter', JSON.stringify(subs));
        } catch (err) {}
        em.value = ''; toast('You\'re on the list. Welcome!', 'success');
      }
      if (api && api.isAvailable && api.isAvailable()) {
        api.subscribe(data).then(function () { em.value = ''; toast('You\'re on the list. Welcome!', 'success'); })
          .catch(function () { localFallback(); });
      } else if (api && api.probe) {
        api.probe().then(function (ok) {
          if (ok) api.subscribe(data).then(function () { em.value = ''; toast('You\'re on the list. Welcome!', 'success'); })
                                     .catch(localFallback);
          else localFallback();
        });
      } else {
        localFallback();
      }
    });
  });

  /* ---------- 18. Booking page — slot picker pre-fill from query ---------- */
  if (document.body && document.body.dataset.page === 'booking') {
    var qProg = qs('program'), qDay = qs('day'), qTime = qs('time');
    var progSel = $('select[name="program"]');
    var daySel  = $('select[name="preferredDay"]');
    var timeSel = $('select[name="preferredTime"]');
    function selectByText(sel, text) {
      if (!sel || !text) return;
      var opts = sel.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].text.toLowerCase().indexOf(text.toLowerCase()) !== -1) { sel.selectedIndex = i; break; }
      }
    }
    if (qProg) selectByText(progSel, qProg);
    if (qDay)  selectByText(daySel, qDay);
    if (qTime) {
      // map HH:MM into existing time-band options
      var hh = parseInt(qTime.split(':')[0], 10);
      var match;
      if (hh >= 6 && hh < 9)       match = 'Early morning';
      else if (hh >= 9 && hh < 12) match = 'Morning';
      else if (hh >= 12 && hh < 14)match = 'Lunchtime';
      else if (hh >= 14 && hh < 17)match = 'Afternoon';
      else if (hh >= 17 && hh < 20)match = 'Evening';
      else                          match = 'Late evening';
      selectByText(timeSel, match);
    }
  }

  /* ---------- 19. Refer-a-friend (thank-you page) ---------- */
  function buildReferLink(firstName) {
    var base = location.origin + location.pathname.replace(/[^/]+$/, '') + 'index.html';
    var ref  = (firstName || 'friend').toLowerCase().replace(/[^a-z0-9]/g, '');
    return base + '?ref=' + encodeURIComponent(ref);
  }
  function enableShareButtons(lead) {
    var copyBtn = $('[data-refer-copy]');
    var waBtn   = $('[data-refer-wa]');
    var emBtn   = $('[data-refer-email]');
    var native  = $('[data-refer-share]');
    var input   = $('[data-refer-link]');
    if (!copyBtn && !input) return;
    var link = buildReferLink(lead && lead.firstName);
    if (input) input.value = link;
    var msg = (lead && lead.firstName ? lead.firstName + ' just' : 'I just') +
      ' booked a free trial at Forge Manchester. Come with me — extra week free if we both join: ' + link;
    if (copyBtn) on(copyBtn, 'click', function () {
      try {
        navigator.clipboard.writeText(link).then(function () { toast('Link copied to clipboard!', 'success'); });
      } catch (e) {
        if (input) { input.select(); document.execCommand('copy'); toast('Link copied!', 'success'); }
      }
    });
    if (waBtn) waBtn.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    if (emBtn) emBtn.href = 'mailto:?subject=' + encodeURIComponent('Train with me at Forge?') + '&body=' + encodeURIComponent(msg);
    if (native && navigator.share) {
      native.style.display = '';
      on(native, 'click', function () {
        navigator.share({ title: 'Forge Martial Arts Manchester', text: msg, url: link })
          .catch(function () { /* user cancelled */ });
      });
    }
  }

  /* ---------- 20. .ics calendar download (thank-you) ---------- */
  function nextOccurrenceForBooking(lead) {
    if (!lead || !lead.preferredDay) return null;
    var dayMap = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
    var targetDay = dayMap[lead.preferredDay];
    if (typeof targetDay !== 'number') return null;
    // Pick a default start time from the band string (e.g., "Evening (5–8pm)")
    var t = (lead.preferredTime || '').toLowerCase();
    var hh = 18, mm = 0;
    if (t.indexOf('early') !== -1)        { hh = 7; }
    else if (t.indexOf('morning') !== -1) { hh = 10; }
    else if (t.indexOf('lunch') !== -1)   { hh = 12; mm = 15; }
    else if (t.indexOf('afternoon')!==-1) { hh = 15; }
    else if (t.indexOf('late') !== -1)    { hh = 20; }
    else if (t.indexOf('evening') !== -1) { hh = 18; }
    var now = new Date();
    var d = new Date(now);
    var diff = (targetDay - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // schedule next week, give buffer
    d.setDate(d.getDate() + diff);
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toICSDate(d) {
    return d.getUTCFullYear()
      + pad(d.getUTCMonth() + 1)
      + pad(d.getUTCDate()) + 'T'
      + pad(d.getUTCHours())
      + pad(d.getUTCMinutes())
      + pad(d.getUTCSeconds()) + 'Z';
  }
  function buildICS(start, end, lead) {
    var prog = (lead && lead.program) || 'Forge Trial Class';
    var summary = 'Forge Free Trial — ' + prog;
    var location = 'Forge Martial Arts Academy, Unit 4 Dale Street, Manchester M1 1JW';
    var description = 'Your free trial class at Forge Martial Arts Academy. Arrive 10 minutes early, wear comfortable kit, bring water. Reception: 0161 200 0000.';
    var uid = 'forge-' + Date.now() + '@forgemartialarts.co.uk';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forge Manchester//Trial//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + toICSDate(new Date()),
      'DTSTART:' + toICSDate(start),
      'DTEND:'   + toICSDate(end),
      'SUMMARY:' + summary,
      'LOCATION:' + location,
      'DESCRIPTION:' + description.replace(/,/g, '\\,'),
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Forge trial class in 1 hour',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }
  function enableCalendarDownload(lead) {
    var btn = $('[data-cal-download]');
    if (!btn) return;
    var start = nextOccurrenceForBooking(lead);
    if (!start) { btn.style.display = 'none'; return; }
    var end = new Date(start.getTime() + 60 * 60 * 1000);
    var dateLabel = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    var timeLabel = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var lbl = btn.querySelector('[data-cal-when]');
    if (lbl) lbl.textContent = dateLabel + ' · ' + timeLabel;
    on(btn, 'click', function (e) {
      e.preventDefault();
      var ics = buildICS(start, end, lead);
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'forge-trial.ics';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
      toast('Calendar invite downloaded.', 'success');
    });
  }

  /* ---------- 21. Service worker (offline cache) ---------- */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      // Root-absolute: a relative 'sw.js' resolves to /programs/sw.js on the
      // discipline pages and 404s. The server already sends
      // Service-Worker-Allowed: / for it.
      navigator.serviceWorker.register('/sw.js').catch(function () { /* offline support optional */ });
    });
  }

  /* ---------- 22. Lazy-init referral attribution ---------- */
  // Persist ?ref= so it survives the booking + signup flow.
  // Stored both in sessionStorage (forms) AND a 30-day cookie (auth/register).
  var ref = qs('ref');
  if (ref) {
    try { sessionStorage.setItem('forge_ref', ref); } catch (e) {}
    document.cookie = 'forge_ref=' + encodeURIComponent(ref) + '; Max-Age=' + (60 * 60 * 24 * 30) + '; Path=/; SameSite=Lax';
    var hidden = $$('input[name="referrer"]');
    hidden.forEach(function (h) { h.value = ref; });
  } else {
    try {
      var prior = sessionStorage.getItem('forge_ref');
      if (prior) $$('input[name="referrer"]').forEach(function (h) { h.value = prior; });
    } catch (e) {}
  }

  /* ---------- Hero video bootstrap (index.html) ----------
     Tries the gym's own uploaded clip first; if it 404s, falls back to
     the demo source from forgePhotos. Bails out under reduced-motion
     or save-data connections. */
  var heroVid = $('#heroVideo');
  if (heroVid && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var saveData = navigator.connection && (navigator.connection.saveData || /(2g|slow-2g)/.test(navigator.connection.effectiveType || ''));
    if (!saveData) {
      var demoSrc    = window.forgePhotos && window.forgePhotos.heroVideo       && window.forgePhotos.heroVideo();
      var demoPoster = window.forgePhotos && window.forgePhotos.heroVideoPoster && window.forgePhotos.heroVideoPoster();
      if (demoPoster) heroVid.poster = demoPoster;
      var setSrc = function (url) {
        heroVid.src = url;
        heroVid.addEventListener('loadeddata', function ok () { heroVid.classList.add('is-ready'); }, { once: true });
      };
      // Probe the uploaded hero with a HEAD request (cheap); fall back on 404.
      fetch('/uploads/video/hero.mp4', { method: 'HEAD' })
        .then(function (r) { setSrc(r.ok ? '/uploads/video/hero.mp4' : demoSrc); })
        .catch(function ()  { if (demoSrc) setSrc(demoSrc); });
    }
  }

  /* ---------- Focus trap (modals + drawer + lightbox) ----------
     Tabbing past the last focusable element loops to the first;
     Shift+Tab past the first goes to the last. */
  function trapFocus(container) {
    if (!container || container.__forgeTrapped) return;
    container.__forgeTrapped = true;
    on(container, 'keydown', function (e) {
      if (e.key !== 'Tab') return;
      var nodes = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    });
  }
  $$('.fmodal').forEach(trapFocus);
  if (drawer) trapFocus(drawer);

  /* ---------- Language switcher ---------- */
  $$('[data-lang]').forEach(function (a) {
    on(a, 'click', function (e) {
      e.preventDefault();
      var l = a.getAttribute('data-lang');
      if (window.forgeI18n) window.forgeI18n.setLang(l);
      else { try { localStorage.setItem('forge_lang', l); } catch (er) {} location.reload(); }
    });
  });

  /* ---------- PWA install prompt ---------- */
  // Captures the beforeinstallprompt event so we can show our own button
  // (browsers only fire it on https on capable devices, once installable).
  var deferredPrompt = null;
  on(window, 'beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var dismissed = false;
    try { dismissed = localStorage.getItem('forge_pwa_dismissed') === '1'; } catch (err) {}
    if (dismissed) return;
    showInstallBanner();
  });
  on(window, 'appinstalled', function () {
    deferredPrompt = null;
    var b = $('.pwa-install'); if (b) b.remove();
    toast('Forge installed. Open it from your home screen.', 'success');
  });
  function showInstallBanner() {
    if (document.querySelector('.pwa-install')) return;
    var box = document.createElement('div');
    box.className = 'pwa-install';
    box.innerHTML =
      '<div class="pwa-install-body">' +
      '  <strong data-i18n="pwa.install.title">Install Forge</strong>' +
      '  <p data-i18n="pwa.install.body">Add Forge to your home screen — works offline.</p>' +
      '</div>' +
      '<div class="pwa-install-actions">' +
      '  <button type="button" class="btn-forge btn-ghost-light" data-pwa-dismiss data-i18n="pwa.install.dismiss">Not now</button>' +
      '  <button type="button" class="btn-forge btn-primary-forge" data-pwa-go data-i18n="pwa.install.go">Install</button>' +
      '</div>';
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('open'); });
    on(box.querySelector('[data-pwa-dismiss]'), 'click', function () {
      try { localStorage.setItem('forge_pwa_dismissed', '1'); } catch (e) {}
      box.classList.remove('open');
      setTimeout(function () { box.remove(); }, 300);
    });
    on(box.querySelector('[data-pwa-go]'), 'click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; box.remove(); });
    });
  }

  /* =========================================================
     22b. THEME — light/dark toggle, persisted, system-aware
     ========================================================= */
  (function () {
    var STORAGE_KEY = 'forge:theme';
    var META_THEME  = $('meta[name="theme-color"]');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    function readStored () {
      try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
    }
    function write (val) {
      try { localStorage.setItem(STORAGE_KEY, val); } catch (_) {}
    }
    function effectiveTheme () {
      return readStored() || (prefersDark.matches ? 'dark' : 'light');
    }
    function applyTheme (theme, opts) {
      document.documentElement.setAttribute('data-theme', theme);
      if (META_THEME) META_THEME.setAttribute('content', theme === 'dark' ? '#0E0F12' : '#F7F4EE');
      $$('.theme-toggle').forEach(function (b) {
        b.setAttribute('aria-pressed', String(theme === 'dark'));
        b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        b.title = theme === 'dark' ? 'Light mode (D)' : 'Dark mode (D)';
      });
      if (opts && opts.toast && window.forgeToast) {
        window.forgeToast(theme === 'dark' ? 'Dark mode on' : 'Light mode on', 'success');
      }
    }

    /* Build the toggle button — single SVG with sun + moon paths,
       cross-faded by [data-theme]. */
    function makeButton () {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-toggle';
      b.innerHTML = ''
        + '<svg class="tt-sun"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
        + '</svg>'
        + '<svg class="tt-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        + '</svg>';
      return b;
    }

    /* Inject into every header's CTA cluster (next to "Book Free Trial").
       Falls back to appending into .nav-row if the cluster is absent. */
    function injectToggles () {
      var headers = $$('.site-header');
      if (!headers.length) return;
      headers.forEach(function (h) {
        if (h.querySelector('.theme-toggle')) return;
        var cluster = h.querySelector('.nav-cta');
        var btn = makeButton();
        if (cluster && cluster.parentNode) {
          cluster.parentNode.insertBefore(btn, cluster);
        } else {
          var row = h.querySelector('.nav-row') || h;
          row.appendChild(btn);
        }
      });
    }

    /* Mirror toggle into the mobile drawer so touch users can flip it
       without hunting in the header's compressed bar. */
    function injectDrawerToggle () {
      var panel = $('.mobile-drawer-panel');
      if (!panel || panel.querySelector('.theme-toggle-row')) return;
      var row = document.createElement('div');
      row.className = 'theme-toggle-row';
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.85rem 0;border-bottom:1px solid rgba(247,244,238,.08);';
      row.innerHTML = '<span style="font-weight:600;">Appearance</span>';
      var btn = makeButton();
      row.appendChild(btn);
      var cta = panel.querySelector('.drawer-cta');
      if (cta) panel.insertBefore(row, cta); else panel.appendChild(row);
    }

    /* Click-anywhere-on-toggle handler — uses event delegation so any
       toggle (header, drawer, future) just works. */
    on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('.theme-toggle');
      if (!btn) return;
      e.preventDefault();
      var current = document.documentElement.getAttribute('data-theme') || effectiveTheme();
      var next = current === 'dark' ? 'light' : 'dark';

      // Cinematic flash from the click point — disabled under reduced-motion via CSS.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var r = btn.getBoundingClientRect();
        var flash = document.createElement('span');
        flash.className = 'theme-flash';
        var size = 24;
        flash.style.cssText = 'left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;width:' + size + 'px;height:' + size + 'px;';
        document.body.appendChild(flash);
        // Apply theme just after the flash starts so the colour swap happens behind the expansion.
        setTimeout(function () { applyTheme(next, { toast: true }); }, 60);
        setTimeout(function () { flash.remove(); }, 560);
      } else {
        applyTheme(next, { toast: true });
      }
      write(next);
    });

    /* Auto-update if the system preference flips and the user hasn't
       chosen explicitly. */
    var sysListener = function () { if (!readStored()) applyTheme(prefersDark.matches ? 'dark' : 'light'); };
    if (prefersDark.addEventListener) prefersDark.addEventListener('change', sysListener);
    else if (prefersDark.addListener) prefersDark.addListener(sysListener);

    /* Cross-tab sync — if the user toggles theme in another tab, mirror it. */
    on(window, 'storage', function (e) {
      if (e.key === STORAGE_KEY && e.newValue) applyTheme(e.newValue);
    });

    injectToggles();
    injectDrawerToggle();
    applyTheme(document.documentElement.getAttribute('data-theme') || effectiveTheme());

    // Keyboard shortcut: D toggles theme (skipped while typing — handled
    // alongside the other shortcuts in module 24).
    window.forgeToggleTheme = function () {
      var b = $('.theme-toggle'); if (b) b.click();
    };
  })();

  /* ---------- 23. Skip-to-content focus ring helper ---------- */
  $$('.skip-link').forEach(function (a) {
    on(a, 'click', function () {
      setTimeout(function () {
        var t = $(a.getAttribute('href'));
        if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: false }); }
      }, 0);
    });
  });

  /* =========================================================
     24. MICRO-INTERACTIONS — every element reacts to the user
     ========================================================= */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Click ripple on every primary surface (buttons, feature cards, program
     cards, stat cells). Uses a single ::after node — no
     DOM bloat. */
  function attachRipple(el) {
    if (el.__forgeRipple) return;
    el.__forgeRipple = true;
    on(el, 'pointerdown', function (e) {
      if (reduceMotion) return;
      var r = el.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 1.6;
      var x = (e.clientX || (r.left + r.width / 2)) - r.left - size / 2;
      var y = (e.clientY || (r.top  + r.height / 2)) - r.top  - size / 2;
      var ink = document.createElement('span');
      ink.className = 'forge-ripple';
      ink.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;';
      el.appendChild(ink);
      setTimeout(function () { ink.remove(); }, 650);
    });
  }
  /* Buttons only. Cards are content, not controls — rippling them on click
     made the whole page feel like a demo reel. */
  $$('.btn-forge, .nav-cta, .drawer-cta').forEach(attachRipple);

  /* Click-to-copy on phone, email and WhatsApp links. The link still works
     normally on long-press / right-click; a quick tap copies + toasts. */
  function bindCopyLink(a, label) {
    if (a.__forgeCopy) return;
    a.__forgeCopy = true;
    on(a, 'click', function (e) {
      // Modifier-click or middle-click → let it through.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      var href = a.getAttribute('href') || '';
      var value = href.replace(/^tel:|^mailto:|^https?:\/\/wa\.me\//, '');
      if (!value) return;
      // On desktop, prefer copy-to-clipboard (no app to open).
      var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        // Long-press style: just let the native action proceed, but still toast.
        try { window.forgeToast && window.forgeToast('Opening ' + label + '…', 'success'); } catch (_) {}
        return;
      }
      e.preventDefault();
      var done = function () { try { window.forgeToast && window.forgeToast(label + ' copied — ' + value, 'success'); } catch (_) {} };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () { done(); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        ta.remove(); done();
      }
    });
  }
  $$('a[href^="tel:"]').forEach(function (a) { bindCopyLink(a, 'Phone'); });
  $$('a[href^="mailto:"]').forEach(function (a) { bindCopyLink(a, 'Email'); });
  $$('a[href*="wa.me/"]').forEach(function (a) { bindCopyLink(a, 'WhatsApp'); });

  /* Stat-cell click → toast a tiny fact while still navigating. Adds a
     micro-confirmation that the click was heard. */
  $$('.stat-cell').forEach(function (cell) {
    on(cell, 'click', function () {
      var num = cell.querySelector('.stat-num');
      var lbl = cell.querySelector('.stat-lbl');
      if (num && lbl && window.forgeToast) {
        window.forgeToast(num.textContent.trim() + ' · ' + lbl.textContent.trim(), 'success');
      }
    });
  });

  /* Keyboard shortcuts. Skipped while typing in a field. */
  on(document, 'keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'b') {
      var bookCta = $('.hero .btn-primary-forge') || $('a[href="booking.html"]');
      if (bookCta) { e.preventDefault(); bookCta.click(); }
    } else if (k === 't') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.forgeToast && window.forgeToast('Back to top', 'success');
    } else if (k === 'f' || k === '?') {
      var faq = $('#faq');
      if (faq) { e.preventDefault(); faq.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } else if (k === 'p') {
      var prog = $('#programs');
      if (prog) { e.preventDefault(); prog.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } else if (k === 'g') {
      e.preventDefault();
      window.location.href = 'gallery.html';
    } else if (k === 'd') {
      e.preventDefault();
      if (window.forgeToggleTheme) window.forgeToggleTheme();
    }
  });

  /* First-visit hint — surface the keyboard shortcuts once so users
     discover them without clutter. */
  (function () {
    try {
      if (sessionStorage.getItem('forge:kb-hint')) return;
      sessionStorage.setItem('forge:kb-hint', '1');
      setTimeout(function () {
        if (window.forgeToast) window.forgeToast('Tip: B = book · T = top · F = FAQ · D = dark mode', 'success');
      }, 3500);
    } catch (_) {}
  })();

})();
