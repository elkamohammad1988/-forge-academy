/* Forge Academy — frontend API client.
   Lives at /js/api.js. Used by app.js when a backend is available; falls back
   to the legacy "simulated submit" path when /api/health doesn't respond. */
(function () {
  'use strict';

  var API = {};
  var BASE = '/api';
  var available = null; // null = unknown, true/false once probed
  var TIMEOUT_MS = 10000;

  function withTimeout(promise, ms) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('timeout')); }, ms); }),
    ]).finally(function () { clearTimeout(timer); });
  }

  function request(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json' };
    var body = opts.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    return withTimeout(fetch(BASE + path, {
      method:      opts.method || 'GET',
      headers:     Object.assign(headers, opts.headers || {}),
      credentials: 'same-origin',
      body:        body,
    }), opts.timeout || TIMEOUT_MS).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      var p  = ct.indexOf('application/json') !== -1 ? res.json() : res.text();
      return p.then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('HTTP ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  API.brand = function () { return request('/brand'); };
  API.deepHealth = function () { return request('/health/deep'); };

  API.probe = function () {
    if (available !== null) return Promise.resolve(available);
    return request('/health', { timeout: 1500 })
      .then(function (d) { available = !!(d && d.ok); return available; })
      .catch(function () { available = false; return false; });
  };

  API.isAvailable = function () { return available === true; };

  API.submitLead     = function (data) { return request('/leads',      { method: 'POST', body: data }); };
  API.contact        = function (data) { return request('/contact',    { method: 'POST', body: data }); };
  API.subscribe      = function (data) { return request('/newsletter', { method: 'POST', body: data }); };

  API.register       = function (data) { return request('/auth/register', { method: 'POST', body: data }); };
  API.login          = function (data) { return request('/auth/login',    { method: 'POST', body: data }); };
  API.logout         = function ()     { return request('/auth/logout',   { method: 'POST', body: {} }); };
  API.me             = function ()     { return request('/auth/me'); };
  API.forgot         = function (email){ return request('/auth/forgot',   { method: 'POST', body: { email: email } }); };
  API.reset          = function (data) { return request('/auth/reset',    { method: 'POST', body: data }); };
  API.verifyEmail    = function (token){ return request('/auth/verify-email', { method: 'POST', body: { token: token } }); };
  API.resendVerify   = function ()     { return request('/auth/verify-email/resend', { method: 'POST', body: {} }); };
  API.updateProfile  = function (data) { return request('/auth/profile',  { method: 'PATCH', body: data }); };
  API.changePassword = function (data) { return request('/auth/change-password', { method: 'POST', body: data }); };

  API.schedule       = function ()     { return request('/schedule'); };
  API.nextClass      = function ()     { return request('/schedule/next'); };

  API.bookings       = function ()     { return request('/bookings'); };
  API.book           = function (data) { return request('/bookings',     { method: 'POST', body: data }); };
  API.cancelBooking  = function (id)   { return request('/bookings/' + encodeURIComponent(id), { method: 'DELETE' }); };

  API.checkout       = function (data) { return request('/checkout/session', { method: 'POST', body: data }); };
  API.billingPortal  = function ()     { return request('/checkout/portal',  { method: 'POST', body: {} }); };

  API.blogPosts      = function ()     { return request('/blog'); };
  API.blogPost       = function (slug) { return request('/blog/' + encodeURIComponent(slug)); };

  API.adminStats     = function ()     { return request('/admin/stats'); };
  API.adminLeads     = function (q)    { return request('/admin/leads' + (q ? '?status=' + encodeURIComponent(q) : '')); };
  API.adminLead      = function (id)   { return request('/admin/leads/' + encodeURIComponent(id)); };
  API.adminAddNote   = function (id, body) {
    return request('/admin/leads/' + encodeURIComponent(id) + '/notes', { method: 'POST', body: { body: body } });
  };
  API.adminContacts  = function ()     { return request('/admin/contacts'); };
  API.adminMembers   = function ()     { return request('/admin/members'); };
  API.adminPatchLead = function (id, status) {
    return request('/admin/leads/' + encodeURIComponent(id), { method: 'PATCH', body: { status: status } });
  };
  API.adminPatchMember = function (id, role) {
    return request('/admin/members/' + encodeURIComponent(id), { method: 'PATCH', body: { role: role } });
  };
  API.adminBroadcast = function (data) { return request('/admin/newsletter/broadcast', { method: 'POST', body: data }); };
  API.adminCapacity  = function (data) { return request('/admin/capacity', { method: 'PUT',  body: data }); };
  API.adminAudit     = function ()     { return request('/admin/audit'); };

  // Web push
  API.pushPublicKey   = function ()      { return request('/push/public-key'); };
  API.pushSubscribe   = function (data)  { return request('/push/subscribe',   { method: 'POST', body: data }); };
  API.pushUnsubscribe = function (ep)    { return request('/push/unsubscribe', { method: 'POST', body: { endpoint: ep } }); };
  API.pushTest        = function ()      { return request('/push/test',        { method: 'POST', body: {} }); };

  // Referrals
  API.myReferrals     = function ()      { return request('/referrals/me'); };

  // 2FA
  API.tfaStatus       = function ()      { return request('/auth/2fa/status'); };
  API.tfaSetup        = function ()      { return request('/auth/2fa/setup',   { method: 'POST', body: {} }); };
  API.tfaEnable       = function (code)  { return request('/auth/2fa/enable',  { method: 'POST', body: { code: code } }); };
  API.tfaDisable      = function (code)  { return request('/auth/2fa/disable', { method: 'POST', body: { code: code } }); };

  // Waivers
  API.waiverCurrent   = function ()      { return request('/waivers/current'); };
  API.waiverStatus    = function ()      { return request('/waivers/me/status'); };
  API.waiverSign      = function (data)  { return request('/waivers/sign', { method: 'POST', body: data }); };
  API.adminWaiverSignatures = function () { return request('/waivers/signatures'); };
  API.adminWaiverPublish    = function (d) { return request('/waivers', { method: 'POST', body: d }); };

  // Uploads
  API.listUploads     = function (kind)  { return request('/uploads/' + encodeURIComponent(kind)); };
  API.uploadFile      = function (kind, file, meta) {
    var fd = new FormData();
    fd.append('file', file);
    if (meta) Object.keys(meta).forEach(function (k) { fd.append(k, meta[k]); });
    return fetch(BASE + '/uploads/' + encodeURIComponent(kind), {
      method: 'POST', credentials: 'same-origin', body: fd,
    }).then(function (r) { return r.json(); });
  };
  API.deleteUpload    = function (kind, id) { return request('/uploads/' + kind + '/' + id, { method: 'DELETE' }); };

  // Personal training
  API.ptSlots          = function ()           { return request('/pt/slots'); };
  API.ptMine           = function ()           { return request('/pt/me'); };
  API.ptCoachSlots     = function ()           { return request('/pt/me/slots'); };
  API.ptPublishSlot    = function (data)       { return request('/pt/me/slots', { method: 'POST', body: data }); };
  API.ptCancelSlot     = function (id)         { return request('/pt/me/slots/' + id, { method: 'DELETE' }); };
  API.ptBook           = function (id)         { return request('/pt/book/' + id, { method: 'POST', body: {} }); };

  // Belt grading
  API.gradingRanks     = function ()           { return request('/gradings/ranks'); };
  API.myGradings       = function ()           { return request('/gradings/me'); };
  API.adminGrant       = function (data)       { return request('/gradings/grant',  { method: 'POST',   body: data }); };
  API.adminMemberGradings = function (id)      { return request('/gradings/member/' + id); };

  // Membership pauses
  API.myPauses         = function ()           { return request('/pauses/me'); };
  API.pauseRequest     = function (data)       { return request('/pauses/me',       { method: 'POST',   body: data }); };
  API.pauseCancel      = function (id)         { return request('/pauses/me/' + id, { method: 'DELETE' }); };
  API.adminPauses      = function ()           { return request('/pauses'); };
  API.adminPauseStatus = function (id, status) { return request('/pauses/' + id, { method: 'PATCH', body: { status: status } }); };

  // Day passes
  API.dayPassCheckout  = function (email)      { return request('/passes/checkout', { method: 'POST', body: { email: email } }); };
  API.dayPassRedeem    = function (code, bid)  { return request('/passes/redeem',   { method: 'POST', body: { code: code, booking_id: bid } }); };
  API.adminPasses      = function ()           { return request('/passes/list'); };

  // Payroll + waitlist promote
  API.adminPayroll     = function (from, to)   { return request('/admin/payroll?from=' + from + '&to=' + to); };
  API.adminPromoteBooking = function (id)      { return request('/admin/bookings/' + id + '/promote', { method: 'POST', body: {} }); };

  // Admin imports
  API.adminImportMembers = function (csv) {
    return fetch(BASE + '/admin/import/members', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'text/csv' }, body: csv,
    }).then(function (r) { return r.json(); });
  };
  API.adminImportNewsletter = function (csv) {
    return fetch(BASE + '/admin/import/newsletter', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'text/csv' }, body: csv,
    }).then(function (r) { return r.json(); });
  };

  API.myAchievements   = function ()     { return request('/achievements/me'); };

  API.coachRoster      = function (date) { return request('/coach/roster' + (date ? '?date=' + encodeURIComponent(date) : '')); };
  API.coachAttendance  = function (data) { return request('/coach/attendance', { method: 'POST', body: data }); };
  API.coachScan        = function (data) { return request('/coach/scan',       { method: 'POST', body: data }); };
  API.myCheckinToken   = function ()     { return request('/coach/me/checkin-token', { method: 'POST', body: {} }); };
  API.myAttendance     = function ()     { return request('/coach/me/attendance'); };

  // Server-Sent Events for live admin feed
  API.subscribeEvents = function (handlers) {
    if (!('EventSource' in window)) return null;
    var src = new EventSource(BASE + '/admin/events', { withCredentials: true });
    Object.keys(handlers || {}).forEach(function (ev) {
      src.addEventListener(ev, function (e) {
        try { handlers[ev](JSON.parse(e.data)); } catch (err) { handlers[ev]({ raw: e.data }); }
      });
    });
    return src;
  };

  // Probe on load so isAvailable() works synchronously elsewhere
  API.probe();

  window.forgeAPI = API;
})();
