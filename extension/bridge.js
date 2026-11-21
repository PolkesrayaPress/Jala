/* Jembatan antara halaman SRIKANDI (agent.js) dan service worker ekstensi.
 * Meneruskan perintah unduh, pengaturan, dan hasil pemeriksaan. Tidak pernah menerima header sesi. */
(function () {
  'use strict';
  const ALLOWED = new Set(['download', 'saveText', 'getDone', 'markDone', 'resetDone', 'getKV', 'setKV',
    'saveTemplate', 'addKnown', 'applySchedule', 'checkResult', 'testNotify']);

  // Halaman -> ekstensi
  window.addEventListener('message', ev => {
    const d = ev.data;
    if (ev.source !== window || ev.origin !== location.origin || !d) return;
    if (d.__srk === 'agent-ping') { window.postMessage({ __srk: 'bridge-ready' }, location.origin); return; }
    if (d.__srk !== 'to-bridge' || !ALLOWED.has(d.type)) return;
    chrome.runtime.sendMessage({ type: d.type, payload: d.payload }, resp => {
      const err = chrome.runtime.lastError;
      window.postMessage({
        __srk: 'from-bridge', id: d.id,
        ok: !err && resp && resp.ok,
        data: resp && resp.data,
        error: err ? err.message : (resp && resp.error)
      }, location.origin);
    });
  });

  // Ekstensi -> halaman (perintah pemeriksaan terjadwal)
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (sender.id !== chrome.runtime.id || !msg || msg.to !== 'page') return;
    if (msg.type === 'runCheck') {
      window.postMessage({ __srk: 'from-bg', type: 'runCheck', payload: msg.payload || {} }, location.origin);
      send({ ack: true });
    }
  });

  window.postMessage({ __srk: 'bridge-ready' }, location.origin);
})();
