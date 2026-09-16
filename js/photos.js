/* Forge — photo & video resolver.
 * Order of preference for any visual asset:
 *
 *   1. Real upload from the gym (admin → /admin.html → Gallery / Coaches)
 *   2. Curated demo photo from a stable CDN (so the live site looks real
 *      out of the box, no placeholders, while the buyer fills in their own)
 *   3. Branded SVG fallback (always works, even offline)
 *
 * The buyer flips the toggle in `config/features.json` → `demoMedia: false`
 * to drop the demo photos and force-fall-back to SVG.
 *
 * Defaults below use Unsplash + Pexels — both have stable hot-link CDNs,
 * royalty-free licensing, no attribution required for non-commercial demo,
 * and explicit per-page CSP allowance.
 */
(function () {
  'use strict';
  var W = window;
  var FEATURES = null;

  // ─── Curated demo photos (martial-arts themed, well-composed) ───────────
  // Picked once for visual consistency. All Unsplash, free to use.
  var UNSPLASH = function (id, w) { return 'https://images.unsplash.com/' + id + '?w=' + (w || 1200) + '&q=80&auto=format&fit=crop'; };

  var DEMO = {
    hero:    UNSPLASH('photo-1517438476312-10d79c077509', 1800),  // boxing silhouette
    gallery: [
      { src: UNSPLASH('photo-1599058917765-a780eda07a3e', 1000), caption: 'BJJ — Tuesday fundamentals' },
      { src: UNSPLASH('photo-1593079831268-3381b0db4a77', 1000), caption: 'Muay Thai — pad night' },
      { src: UNSPLASH('photo-1549824971-89b64deea580',  1000), caption: 'Boxing — Saturday sparring' },
      { src: UNSPLASH('photo-1599586120429-48281b6f0ece', 1000), caption: 'Kids Karate — Tigers' },
      { src: UNSPLASH('photo-1571019613454-1cb2f99b2d8b', 1000), caption: 'Strength & conditioning' },
      { src: UNSPLASH('photo-1517649763962-0c623066013b', 1000), caption: 'Open mat — Sunday' },
      { src: UNSPLASH('photo-1583454110551-21f2fa2afe61', 1000), caption: 'Reception & merch' },
      { src: UNSPLASH('photo-1546519638-68e109498ffc',   1000), caption: 'Friday fight night tune-up' },
    ],
    coaches: {
      mateo:  UNSPLASH('photo-1500648767791-00dcc994a43e', 600),
      sasha:  UNSPLASH('photo-1583454110551-21f2fa2afe61', 600),
      lara:   UNSPLASH('photo-1494790108377-be9c29b29330', 600),
      carlos: UNSPLASH('photo-1507003211169-0a1dd7228f2d', 600),
      tom:    UNSPLASH('photo-1472099645785-5658abf4ff4e', 600),
    },
    // Pexels CDN sample (royalty-free) — replaceable by uploading /uploads/video/hero.mp4
    heroVideo: 'https://videos.pexels.com/video-files/8012559/8012559-uhd_2560_1440_25fps.mp4',
    heroVideoPoster: UNSPLASH('photo-1517438476312-10d79c077509', 1800),
  };

  function getFeatures() {
    if (FEATURES !== null) return FEATURES;
    if (W.forgeBrand && W.forgeBrand.features) { FEATURES = W.forgeBrand.features; return FEATURES; }
    return {};
  }
  function demoEnabled() {
    var f = getFeatures();
    return f.demoMedia !== false;        // default ON
  }

  // ─── Render helpers ─────────────────────────────────────────────────────
  W.forgePhotos = {
    /** Hero image src for index.html (already in DOM as background) */
    hero: function () { return demoEnabled() ? DEMO.hero : ''; },
    heroVideo:       function () { return demoEnabled() ? DEMO.heroVideo       : ''; },
    heroVideoPoster: function () { return demoEnabled() ? DEMO.heroVideoPoster : ''; },

    /** Coach photo by key (mateo / sasha / lara / carlos / tom) */
    coach: function (key) { return demoEnabled() ? DEMO.coaches[key] || '' : ''; },

    /**
     * Resolve gallery — uses uploaded photos when present, else demo,
     * else hands back null so caller renders SVG fallback.
     */
    galleryAsync: function () {
      // Prefer real uploads
      if (W.forgeAPI && W.forgeAPI.listUploads) {
        return W.forgeAPI.listUploads('gallery').then(function (r) {
          if (r && r.uploads && r.uploads.length) return r.uploads;
          return demoEnabled() ? DEMO.gallery.map(function (g) { return { url: g.src, caption: g.caption, mime: 'image/jpeg' }; }) : [];
        }).catch(function () {
          return demoEnabled() ? DEMO.gallery.map(function (g) { return { url: g.src, caption: g.caption, mime: 'image/jpeg' }; }) : [];
        });
      }
      return Promise.resolve(demoEnabled() ? DEMO.gallery.map(function (g) { return { url: g.src, caption: g.caption, mime: 'image/jpeg' }; }) : []);
    },

    /** True if a URL points at the uploads folder (i.e. real photo, not demo) */
    isReal: function (url) { return /^\/uploads\//.test(String(url || '')); },
  };
})();
