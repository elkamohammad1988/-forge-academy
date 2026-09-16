/* Frontend web-push helper. Permission flow + service-worker registration +
   subscribe to /api/push/subscribe. Idempotent — safe to call multiple times.
*/
(function () {
  'use strict';

  function urlBase64ToUint8(base64) {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async function subscribe() {
    if (!isSupported()) throw new Error('Push not supported on this browser');
    const api = window.forgeAPI;
    if (!api) throw new Error('forgeAPI not loaded');
    const cfg = await api.pushPublicKey ? api.pushPublicKey() : fetch('/api/push/public-key').then((r) => r.json());
    if (!cfg.enabled || !cfg.publicKey) throw new Error('Push is not enabled on the server');

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notification permission denied');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8(cfg.publicKey),
      });
    }

    const body = sub.toJSON();
    await api.pushSubscribe({ endpoint: body.endpoint, keys: body.keys });
    return sub;
  }

  async function unsubscribe() {
    if (!isSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    if (window.forgeAPI) {
      try { await window.forgeAPI.pushUnsubscribe(sub.endpoint); } catch (e) {}
    }
    await sub.unsubscribe();
  }

  async function isSubscribed() {
    if (!isSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }

  window.forgePush = { isSupported, isSubscribed, subscribe, unsubscribe };
})();
