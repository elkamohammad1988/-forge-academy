/* Forge i18n — runtime translation layer.
   - Loads /locales/<lang>.json on demand
   - Replaces text content of any [data-i18n] element
   - Updates html[lang] and html[dir] (RTL aware)
   - Persists choice in localStorage; respects ?lang=
*/
(function () {
  'use strict';
  var STORE_KEY = 'forge_lang';
  var DEFAULT   = 'en';
  var dict = {};

  function fetchLocale(lang) {
    return fetch('locales/' + encodeURIComponent(lang) + '.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  function applyDict(d) {
    if (!d) return;
    dict = d;
    document.documentElement.lang = d.$lang || 'en';
    document.documentElement.dir  = d.$rtl ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (d[key]) el.textContent = d[key];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      // data-i18n-attr="placeholder:cta.book"
      var spec = el.getAttribute('data-i18n-attr');
      var parts = spec.split(':'); var attr = parts[0]; var key = parts[1];
      if (attr && key && d[key]) el.setAttribute(attr, d[key]);
    });
    document.dispatchEvent(new CustomEvent('forge:lang', { detail: { lang: d.$lang } }));
  }

  function pickLang() {
    var qs = (location.search.match(/[?&]lang=([a-zA-Z-]+)/) || [])[1];
    if (qs) { try { localStorage.setItem(STORE_KEY, qs); } catch (e) {} return qs; }
    try { var s = localStorage.getItem(STORE_KEY); if (s) return s; } catch (e) {}
    var nav = (navigator.language || 'en').toLowerCase();
    if (nav.indexOf('ar') === 0) return 'ar';
    return DEFAULT;
  }

  window.forgeI18n = {
    t: function (key, fb) { return dict[key] || fb || key; },
    setLang: function (lang) {
      try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
      fetchLocale(lang).then(applyDict);
    },
  };

  fetchLocale(pickLang()).then(applyDict).catch(function () {});
})();
