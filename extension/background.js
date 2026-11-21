/* JALA Arsip v1.4.1 - service worker.
 * Unduhan, penyimpanan riwayat/pengaturan, jadwal pemeriksaan, notifikasi desktop. */
'use strict';
importScripts('core.js');
const C = self.__SRK_CORE;

const ALLOWED_DL_HOST = 's3.arsip.go.id';
const ORIGIN = 'https://srikandi.arsip.go.id/';
const ICON = 'icons/icon128.png';
const ALARM = 'srk-check';

/* ---------- Penyimpanan ---------- */
const get = async k => (await chrome.storage.local.get(k))[k];
const set = obj => chrome.storage.local.set(obj);
// Semua penulisan storage dijalankan berurutan agar tidak saling menimpa (temuan audit #5).
let chain = Promise.resolve();
const serial = fn => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

async function settings() { return Object.assign({}, C.DEFAULT_SETTINGS, (await get('srk_settings')) || {}); }

function addToSet(key, items) { return serial(() => addToSetNow(key, items)); }
async function addToSetNow(key, items) {
  const cur = new Set((await get(key)) || []);
  (items || []).forEach(k => cur.add(k));
  await set({ [key]: [...cur] });
  return cur.size;
}

function saveTemplate(path, url) { return serial(() => saveTemplateNow(path, url)); }
async function saveTemplateNow(path, url) {
  if (!C.isValidTemplate(path, url)) return false;
  const t = (await get('srk_templates')) || {};
  const list = t[path] || [];
  if (!list.includes(url)) { list.push(url); t[path] = list.slice(-6); await set({ srk_templates: t }); }
  return true;
}

/* ---------- Unduhan ---------- */
function waitForDownload(id, timeoutMs) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => end(new Error('Unduhan terlalu lama')), timeoutMs);
    function end(err, name) {
      if (finished) return; finished = true;
      clearTimeout(timer); chrome.downloads.onChanged.removeListener(fn);
      err ? reject(err) : resolve(name);
    }
    function check() {
      chrome.downloads.search({ id }, items => {
        const it = items && items[0];
        if (!it) return;
        if (it.state === 'complete') end(null, it.filename);
        else if (it.state === 'interrupted') end(new Error('Unduhan terputus: ' + (it.error || 'tidak diketahui')));
      });
    }
    function fn(delta) { if (delta.id === id && delta.state) check(); }
    chrome.downloads.onChanged.addListener(fn);
    check();
  });
}

// Unduhan yang sedang berjalan dicatat agar tetap dapat ditandai selesai walau service worker
// sempat berhenti di tengah transfer (gabungan dari audit ChatGPT F07).
function pendingSet(id, val) { return serial(async () => { const p = (await get('srk_pending')) || {}; if (val) p[id] = val; else delete p[id]; await set({ srk_pending: p }); }); }
async function reconcilePending() {
  const p = (await get('srk_pending')) || {};
  for (const id of Object.keys(p)) {
    const items = await chrome.downloads.search({ id: Number(id) });
    const it = items && items[0];
    if (!it || it.state === 'interrupted') await pendingSet(id, null);
    else if (it.state === 'complete') { await addToSet('srk_done_keys', [p[id].key]); await pendingSet(id, null); }
  }
}
chrome.downloads.onChanged.addListener(d => { if (d.state && d.state.current !== 'in_progress') reconcilePending().catch(() => {}); });
reconcilePending().catch(() => {});

async function download(url, filename, key) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.host !== ALLOWED_DL_HOST) throw new Error('Alamat unduhan di luar ' + ALLOWED_DL_HOST);
  if (!C.isSafeDownloadName(filename, false)) throw new Error('Nama file di luar folder SRIKANDI_ARSIP ditolak');
  // PDF menimpa berkas bernama sama: nama dibentuk dari tanggal, nomor, dan hal, jadi pengunduhan ulang
  // (misalnya setelah pindah folder ekstensi) tidak menghasilkan salinan ganda 'nama (1).pdf'.
  const id = await chrome.downloads.download({ url, filename, conflictAction: 'overwrite', saveAs: false });
  if (key) await pendingSet(id, { key, filename, at: Date.now() });
  const full = await waitForDownload(id, 180000);
  if (key) { await addToSet('srk_done_keys', [key]); await pendingSet(id, null); }
  return { filename: full || filename };
}

async function saveText(filename, text, mime) {
  if (!C.isSafeDownloadName(filename, true)) throw new Error('Nama indeks tidak valid');
  if (typeof text !== 'string' || text.length > 20 * 1024 * 1024) throw new Error('Indeks terlalu besar');
  mime = 'text/csv';
  const b64 = btoa(unescape(encodeURIComponent(text)));
  const id = await chrome.downloads.download({ url: 'data:' + (mime || 'text/plain') + ';charset=utf-8;base64,' + b64, filename, conflictAction: 'uniquify', saveAs: false });
  return { filename: (await waitForDownload(id, 60000)) || filename };
}

/* ---------- Notifikasi & lencana ---------- */
function notify(id, title, message) {
  return new Promise(r => chrome.notifications.create(id, { type: 'basic', iconUrl: ICON, title, message, priority: 2 }, () => r(true)));
}

async function setBadge(n) {
  await set({ srk_badge: n });
  await chrome.action.setBadgeText({ text: n ? String(n > 99 ? '99+' : n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
}

async function openSrikandi() {
  await setBadge(0);
  const tabs = await chrome.tabs.query({ url: ORIGIN + '*' });
  const t = tabs.find(x => !x.pinned) || tabs[0];
  if (t) { await chrome.tabs.update(t.id, { active: true }); if (t.windowId != null) chrome.windows.update(t.windowId, { focused: true }); }
  else await chrome.tabs.create({ url: C.LIST_URL, active: true });
}

/* ---------- Jadwal ---------- */
async function schedule() {
  const s = await settings();
  await chrome.alarms.clear(ALARM);
  const m = { '30': 30, '60': 60, '180': 180, '360': 360 }[s.monitor];
  if (m) chrome.alarms.create(ALARM, { delayInMinutes: m, periodInMinutes: m });
  else if (s.monitor === 'daily') chrome.alarms.create(ALARM, { when: C.nextDaily(s.dailyAt), periodInMinutes: 1440 });
  return s.monitor;
}

async function startCheck() {
  const s = await settings();
  if (s.monitor === 'off') return;
  const tabs = await chrome.tabs.query({ url: ORIGIN + '*' });
  let tab = tabs[0], auto = false;
  if (!tab) {
    if (!s.autoOpenTab) { await notify('srk-tab', 'JALA', 'Pemeriksaan dilewati karena tab SRIKANDI tertutup.'); return; }
    tab = await chrome.tabs.create({ url: C.LIST_URL, active: false, pinned: true });
    auto = true;
    await chrome.storage.session.set({ srk_auto_tab: tab.id });
  }
  for (let i = 0; i < 20; i++) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { to: 'page', type: 'runCheck', payload: { manual: false } });
      if (r && r.ack) return;
    } catch (e) { /* skrip belum siap */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  await notify('srk-err', 'JALA', 'Pemeriksaan tidak dapat dijalankan di tab SRIKANDI. Muat ulang tab tersebut.');
  if (auto) { chrome.tabs.remove(tab.id).catch(() => {}); chrome.storage.session.remove('srk_auto_tab'); }
}

async function handleCheckResult(r, tabId) {
  r = r || { newItems: [] };
  await set({ srk_last_check: { at: Date.now(), n: (r.newItems || []).length, error: r.error || null } });
  if (r.error === 'busy') return;   // tab sedang bekerja: jangan ditutup (temuan audit #6)
  const { srk_auto_tab } = await chrome.storage.session.get('srk_auto_tab');
  if (srk_auto_tab != null && srk_auto_tab === tabId) {
    chrome.tabs.remove(tabId).catch(() => {});
    chrome.storage.session.remove('srk_auto_tab');
  }
  if (r.error === 'session-changed') { await notify('srk-session', 'JALA Arsip berhenti', 'Sesi di tab SRIKANDI berubah. Muat ulang tab SRIKANDI (F5) agar pemeriksaan berjalan lagi.'); return; }
  if (r.error === 'session') {
    const last = (await get('srk_session_warned')) || 0;
    if (r.manual || Date.now() - last > 6 * 3600 * 1000) {
      await set({ srk_session_warned: Date.now() });
      await notify('srk-session', 'Sesi SRIKANDI habis', 'Login ulang ke SRIKANDI agar pemeriksaan naskah baru dapat berjalan.');
    }
    return;
  }
  if (r.error) { await notify('srk-err', 'Pemeriksaan SRIKANDI gagal', String(r.error).slice(0, 180)); return; }
  if (r.newItems && r.newItems.length) {
    const t = C.notifText(r.newItems, (await settings()).notifDetail);
    await setBadge(((await get('srk_badge')) || 0) + t.count);
    const extra = r.downloaded ? '\n' + r.downloaded + ' file sudah diunduh ke folder arsip.' : '';
    await notify('srk-new-' + Date.now(), t.title, t.message + extra);
  } else if (r.manual) {
    await notify('srk-none', 'JALA', 'Tidak ada naskah baru.');
  }
}

/* ---------- Pesan dari halaman ---------- */
const OPTIONS_URL = chrome.runtime.getURL('options.html');
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  // Perintah yang menghapus riwayat hanya diterima dari halaman opsi milik ekstensi (temuan audit #8).
  if (sender.id === chrome.runtime.id && sender.url && sender.url.startsWith(OPTIONS_URL)) {
    const ops = {
      resetDone: () => serial(() => chrome.storage.local.remove('srk_done_keys')).then(() => true),
      resetKnown: () => serial(() => chrome.storage.local.remove(['srk_known', 'srk_baseline', 'srk_retry', 'srk_retry_dead'])).then(() => true),
      resetTemplates: () => serial(() => chrome.storage.local.remove('srk_templates')).then(() => true),
      stats: async () => ({ done: ((await get('srk_done_keys')) || []).length, known: ((await get('srk_known')) || []).length, retry: Object.keys((await get('srk_retry')) || {}).length, dead: ((await get('srk_retry_dead')) || []).length, templates: Object.values((await get('srk_templates')) || {}).reduce((a, b) => a + b.length, 0), last: (await get('srk_last_check')) || null, id: chrome.runtime.id, version: chrome.runtime.getManifest().version }),
      exportData: async () => ({ app: 'JALA Arsip', format: 1, version: chrome.runtime.getManifest().version, exported: new Date().toISOString(),
        data: await chrome.storage.local.get(['srk_done_keys', 'srk_known', 'srk_baseline', 'srk_settings', 'srk_templates']) }),
      importData: () => serial(async () => {
        const d = msg.payload && msg.payload.data;
        if (!msg.payload || msg.payload.app !== 'JALA Arsip' || !d || typeof d !== 'object') throw new Error('Berkas bukan cadangan JALA Arsip');
        const merge = async k => { if (Array.isArray(d[k])) { const cur = new Set((await get(k)) || []); d[k].filter(x => typeof x === 'string' && x.length < 600).forEach(x => cur.add(x)); await set({ [k]: [...cur] }); } };
        for (const k of ['srk_done_keys', 'srk_known', 'srk_baseline']) await merge(k);
        if (d.srk_settings) await set({ srk_settings: C.sanitizeSettings(d.srk_settings) });
        if (d.srk_templates && typeof d.srk_templates === 'object') {
          const t = (await get('srk_templates')) || {};
          Object.keys(d.srk_templates).forEach(path => (d.srk_templates[path] || []).forEach(url => { if (C.isValidTemplate(path, url)) { t[path] = t[path] || []; if (!t[path].includes(url)) t[path].push(url); } }));
          await set({ srk_templates: t });
        }
        return { done: ((await get('srk_done_keys')) || []).length };
      })
    };
    const job = ops[msg.type] ? ops[msg.type]() : Promise.reject(new Error('Perintah tidak dikenal'));
    Promise.resolve(job).then(data => send({ ok: true, data })).catch(e => send({ ok: false, error: e.message }));
    return true;
  }
  if (!sender.url || !sender.url.startsWith(ORIGIN) || !sender.tab) { send({ ok: false, error: 'Pengirim tidak dikenal' }); return; }
  const p = msg.payload || {};
  const tabId = sender.tab && sender.tab.id;
  const onlySrk = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith('srk_')));
  const jobs = {
    download: () => download(p.url, p.filename, typeof p.key === 'string' ? p.key.slice(0, 600) : null),
    saveText: () => saveText(p.filename, p.text, p.mime),
    getDone: async () => (await get('srk_done_keys')) || [],
    markDone: () => addToSet('srk_done_keys', p.keys),
    getKV: async () => onlySrk(await chrome.storage.local.get((p.keys || []).filter(k => ['srk_templates', 'srk_settings', 'srk_last_check', 'srk_known', 'srk_baseline', 'srk_retry', 'srk_retry_dead'].includes(k)))),
    setKV: () => serial(() => set({ srk_settings: C.sanitizeSettings(p.obj && p.obj.srk_settings) })).then(() => true),
    saveTemplate: () => saveTemplate(p.path, p.url),
    addKnown: async () => { await addToSet('srk_known', p.keys); await addToSet('srk_baseline', p.baseline); return true; },
    updRetry: () => serial(async () => {
      // Maksimum 5 percobaan dengan jeda 30, 60, 120, 240 menit; setelah itu masuk daftar tinjauan manual.
      let cur = (await get('srk_retry')) || {};
      if (Array.isArray(cur)) cur = Object.fromEntries(cur.map(k => [k, { n: 1, next: 0 }]));
      const dead = (await get('srk_retry_dead')) || [];
      (p.add || []).forEach(k => {
        const n = ((cur[k] && cur[k].n) || 0) + 1;
        if (n > 5) { delete cur[k]; if (!dead.includes(k)) dead.push(k); }
        else cur[k] = { n, next: Date.now() + 30 * 60000 * Math.pow(2, n - 1) };
      });
      (p.remove || []).forEach(k => { delete cur[k]; });
      await set({ srk_retry: cur, srk_retry_dead: dead.slice(-500) }); return Object.keys(cur).length;
    }),
    applySchedule: () => schedule(),
    checkResult: () => handleCheckResult(p, tabId).then(() => true),
    testNotify: () => notify('srk-test', 'JALA', 'Notifikasi berfungsi. Naskah baru akan muncul seperti ini.')
  };
  const job = jobs[msg.type] ? jobs[msg.type]() : Promise.reject(new Error('Perintah tidak dikenal'));
  Promise.resolve(job).then(data => send({ ok: true, data })).catch(e => send({ ok: false, error: e.message }));
  return true;
});

chrome.alarms.onAlarm.addListener(a => { if (a.name === ALARM) startCheck(); });
chrome.notifications.onClicked.addListener(id => { chrome.notifications.clear(id); openSrikandi(); });
chrome.action.onClicked.addListener(() => openSrikandi());
chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => schedule());
