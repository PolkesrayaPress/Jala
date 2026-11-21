/* JALA (Jaring Arsip Lokal Otomatis) v1.2 - service worker.
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
async function settings() { return Object.assign({}, C.DEFAULT_SETTINGS, (await get('srk_settings')) || {}); }

async function addToSet(key, items) {
  const cur = new Set((await get(key)) || []);
  (items || []).forEach(k => cur.add(k));
  await set({ [key]: [...cur] });
  return cur.size;
}

async function saveTemplate(path, url) {
  if (!C.SOURCES.some(s => s.path === path)) return false;
  const u = new URL(url);
  if (u.host !== 'api.arsip.go.id') return false;
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

async function download(url, filename) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.host !== ALLOWED_DL_HOST) throw new Error('Alamat unduhan di luar ' + ALLOWED_DL_HOST);
  const id = await chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: false });
  return { filename: (await waitForDownload(id, 180000)) || filename };
}

async function saveText(filename, text, mime) {
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
  const { srk_auto_tab } = await chrome.storage.session.get('srk_auto_tab');
  if (srk_auto_tab != null && srk_auto_tab === tabId) {
    chrome.tabs.remove(tabId).catch(() => {});
    chrome.storage.session.remove('srk_auto_tab');
  }
  if (r.error === 'busy') return;
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
    const t = C.notifText(r.newItems);
    await setBadge(((await get('srk_badge')) || 0) + t.count);
    const extra = r.downloaded ? '\n' + r.downloaded + ' file sudah diunduh ke folder arsip.' : '';
    await notify('srk-new-' + Date.now(), t.title, t.message + extra);
  } else if (r.manual) {
    await notify('srk-none', 'JALA', 'Tidak ada naskah baru.');
  }
}

/* ---------- Pesan dari halaman ---------- */
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!sender.url || !sender.url.startsWith(ORIGIN)) { send({ ok: false, error: 'Pengirim tidak dikenal' }); return; }
  const p = msg.payload || {};
  const tabId = sender.tab && sender.tab.id;
  const onlySrk = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith('srk_')));
  const jobs = {
    download: () => download(p.url, p.filename),
    saveText: () => saveText(p.filename, p.text, p.mime),
    getDone: async () => (await get('srk_done_keys')) || [],
    markDone: () => addToSet('srk_done_keys', p.keys),
    resetDone: () => chrome.storage.local.remove('srk_done_keys').then(() => true),
    getKV: async () => onlySrk(await chrome.storage.local.get((p.keys || []).filter(k => k.startsWith('srk_')))),
    setKV: () => set(onlySrk(p.obj)).then(() => true),
    saveTemplate: () => saveTemplate(p.path, p.url),
    addKnown: async () => { await addToSet('srk_known', p.keys); await addToSet('srk_baseline', p.baseline); return true; },
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
