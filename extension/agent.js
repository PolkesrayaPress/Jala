/* JALA Arsip v1.3 - berjalan di halaman SRIKANDI (MAIN world).
 * Prinsip:
 *  - Hanya membaca: daftar naskah, master klasifikasi, dan URL unduhan berkas.
 *    Tidak pernah memanggil endpoint tanda tangan, verifikasi, disposisi, atau pemberkasan.
 *  - Tidak membuka halaman detail naskah (detail menandai naskah "dibaca").
 *  - Sesi login dipakai ulang dari aplikasi SRIKANDI dan hanya disimpan di variabel skrip ini
 *    selama tab terbuka. Tidak ditulis ke penyimpanan, tidak dikirim ke mana pun selain api.arsip.go.id.
 */
(function () {
  'use strict';
  if (window.__srkAgentLoaded) return;
  window.__srkAgentLoaded = true;

  const C = window.__SRK_CORE;
  const API = 'https://api.arsip.go.id';
  const BUCKET = 'srikandi-prod';

  let session = null;
  const sessionWaiters = [];
  const templates = {};             // path API -> Map(url)
  const klCache = new Map();
  let settings = Object.assign({}, C.DEFAULT_SETTINGS);
  let running = false, stopFlag = false, lastCheck = null;

  /* ---------- 1. Belajar dari panggilan aplikasi ---------- */
  function addTemplate(path, url, persist) {
    if (!templates[path]) templates[path] = new Map();
    if (templates[path].has(url)) return;
    templates[path].set(url, url);
    if (persist) bridge('saveTemplate', { path, url }).catch(() => {});
    refreshPanel();
  }

  const oOpen = XMLHttpRequest.prototype.open;
  const oSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      const u = new URL(url, location.href);
      this.__srkHost = u.host;
      if (String(method).toUpperCase() === 'GET' && u.host === 'api.arsip.go.id') {
        const src = C.SOURCES.find(s => s.path === u.pathname);
        const t = src && C.sanitizeTemplate(u.toString());
        if (t && C.isValidTemplate(src.path, t)) addTemplate(src.path, t, true);
      }
    } catch (e) { /* abaikan */ }
    return oOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try {
      if (this.__srkHost === 'api.arsip.go.id' && /^authorization$/i.test(k) && v) {
        const first = !session; session = v;
        if (first) { sessionWaiters.splice(0).forEach(f => f()); refreshPanel(); }
      }
    } catch (e) { /* abaikan */ }
    return oSet.apply(this, arguments);
  };

  function waitSession(ms) {
    if (session) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Sesi SRIKANDI tidak terdeteksi (belum login atau sesi habis)')), ms);
      sessionWaiters.push(() => { clearTimeout(t); resolve(); });
    });
  }

  /* ---------- 2. Jembatan ke ekstensi ---------- */
  let bridgeReadyResolve; const bridgeReady = new Promise(r => { bridgeReadyResolve = r; });
  let reqId = 0; const pending = new Map();
  window.addEventListener('message', ev => {
    if (ev.source !== window) return;
    const d = ev.data; if (!d) return;
    if (d.__srk === 'bridge-ready') { bridgeReadyResolve(); return; }
    if (d.__srk === 'from-bridge') {
      const p = pending.get(d.id); if (!p) return;
      pending.delete(d.id); d.ok ? p.resolve(d.data) : p.reject(new Error(d.error || 'bridge error'));
      return;
    }
    if (d.__srk === 'from-bg' && d.type === 'runCheck') {
      runCheck(d.payload || {}).then(r => bridge('checkResult', r)).catch(() => {});
    }
  });
  window.postMessage({ __srk: 'agent-ping' }, location.origin);

  async function bridge(type, payload) {
    await bridgeReady;
    return new Promise((resolve, reject) => {
      const id = ++reqId; pending.set(id, { resolve, reject });
      window.postMessage({ __srk: 'to-bridge', id, type, payload }, location.origin);
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Timeout ekstensi: ' + type)); } }, 180000);
    });
  }

  async function init() {
    try {
      const kv = await bridge('getKV', { keys: ['srk_templates', 'srk_settings', 'srk_last_check'] });
      const st = kv.srk_templates || {};
      Object.keys(st).forEach(p => (st[p] || []).forEach(u => { if (C.isValidTemplate(p, u)) addTemplate(p, u, false); }));
      settings = C.sanitizeSettings(kv.srk_settings);
      lastCheck = kv.srk_last_check || null;
      fillPanel();
    } catch (e) { log('Gagal memuat pengaturan: ' + e.message); }
  }
  init();

  /* ---------- 3. Panggilan API ---------- */
  const sleep = ms => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());

  async function api(url, opt) {
    opt = opt || {};
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.host !== 'api.arsip.go.id') throw new Error('Alamat API di luar api.arsip.go.id ditolak');
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!session) throw new Error('Sesi SRIKANDI belum terdeteksi. Buka salah satu halaman daftar naskah dulu.');
      const headers = { 'Accept': 'application/json', 'Authorization': session };
      if (opt.body) headers['Content-Type'] = 'application/json';
      let r;
      try {
        r = await fetch(url, { method: opt.method || 'GET', headers, body: opt.body ? JSON.stringify(opt.body) : undefined });
      } catch (e) { await sleep(2000 * (attempt + 1)); continue; }
      if (r.status === 401 || r.status === 403) throw new Error('Sesi habis atau ditolak (' + r.status + '). Muat ulang halaman, login bila perlu, lalu jalankan lagi. Unduhan lama tidak diulang.');
      if (r.status === 429 || r.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { throw new Error('Respons bukan JSON (' + r.status + ')'); }
    }
    throw new Error('Gagal setelah beberapa percobaan');
  }

  function rowsOf(j) {
    const res = j && j.result;
    return { rows: Array.isArray(res) ? res : (res && res.data) || [], next: res && !Array.isArray(res) ? res.next_cursor || null : null };
  }

  async function* iterateRows(src, rows, delay) {
    const tpls = templates[src.path] ? [...templates[src.path].values()] : [];
    for (const t of tpls) {
      let cursor = null, guard = 0;
      do {
        if (stopFlag) return;
        const u = new URL(t);
        u.searchParams.set('rows', String(rows));
        if (cursor) u.searchParams.set('cursor', cursor);
        const page = rowsOf(await api(u.toString()));
        for (const row of page.rows) yield row;
        cursor = page.next;
        if (++guard > 5000) break;
        await sleep(delay);
      } while (cursor);
    }
  }

  async function klasifikasi(id) {
    if (!id) return null;
    if (klCache.has(id)) return klCache.get(id);
    let v = null;
    try {
      const j = await api(API + '/master/api/klasifikasi/' + encodeURIComponent(id));
      if (j && j.result) v = { kode: j.result.kode, nama: j.result.nama };
    } catch (e) { if (/Sesi/.test(e.message)) throw e; }
    klCache.set(id, v);
    return v;
  }

  async function fileInfo(item) {
    if (item.file && item.filePath) return item;
    if (item.naskahMasukId) {
      const j = await api(API + '/naskah-masuk/api/naskah-dinas/naskah-masuk/get-content-file', { method: 'POST', body: { id: item.naskahMasukId } });
      if (j && j.result) { item.file = j.result.file; item.filePath = j.result.file_path; }
    }
    return item;
  }

  async function signedUrl(item) {
    const u = new URL(API + '/storage/geturlpreview');
    u.searchParams.set('filename', item.file);
    u.searchParams.set('folder', item.filePath);
    u.searchParams.set('bucket', BUCKET);
    const j = await api(u.toString());
    return (j && (j.url || (j.result && j.result.url))) || null;
  }

  /* ---------- 4. Satu naskah ---------- */
  async function processItem(it, rec, ctx) {
    try {
      await fileInfo(it);
      rec.file = it.file; rec.filePath = it.filePath;
      const key = C.dedupKey(it);
      if (!it.file || !it.filePath) { rec.result = 'TIDAK ADA FILE'; rec.note = 'Naskah tanpa berkas di SRIKANDI'; ctx.stats.fail++; }
      else if (it.otp) { rec.result = 'DILEWATI'; rec.note = 'Naskah dilindungi OTP, unduh manual'; ctx.stats.skip++; }
      else if (ctx.seen.has(key)) { rec.result = 'DUPLIKAT'; rec.note = 'Sudah diproses dari daftar lain'; ctx.stats.dup++; }
      else if (ctx.done.has(key)) { ctx.seen.add(key); rec.result = 'SUDAH ADA'; rec.localPath = C.buildPath(it, rec.kl, settings.layout); ctx.stats.skip++; }
      else {
        ctx.seen.add(key);   // dipesan sebelum await agar unduhan paralel tidak ganda
        const t0 = Date.now();
        const url = await signedUrl(it);
        if (!url) throw new Error('URL unduhan tidak diberikan server');
        const t1 = Date.now();
        const res = await bridge('download', { url, filename: C.buildPath(it, rec.kl, settings.layout) });
        const t2 = Date.now();
        rec.localPath = res && res.filename ? res.filename : C.buildPath(it, rec.kl, settings.layout);
        rec.result = 'BERHASIL'; ctx.stats.ok++;
        rec.timing = ' (url ' + ((t1 - t0) / 1000).toFixed(1) + ' dtk, unduh ' + ((t2 - t1) / 1000).toFixed(1) + ' dtk)';
        ctx.done.add(key);
        await bridge('markDone', { keys: [key] });
      }
    } catch (e) {
      rec.result = 'GAGAL'; rec.note = e.message; ctx.stats.fail++;
      if (/Sesi/.test(e.message)) ctx.fatal = e;
    }
    log('[' + rec.result + '] ' + (it.tanggal || '').slice(0, 10) + ' ' + ((rec.kode || (it.nomor || '').split('/')[0]) || '') + ' ' + (it.hal || '').slice(0, 50) + (rec.timing || '') + (rec.result === 'GAGAL' ? ': ' + rec.note : ''));
    return rec;
  }

  function newRec(it, kl) {
    return Object.assign({}, it, { kode: kl.kode, klNama: kl.nama, klAsal: kl.asal, kl, result: '', note: '' });
  }

  /* ---------- 5. Unduh sesuai pengaturan ---------- */
  function saveIndex(records, prefix) {
    if (!records.length) return Promise.resolve();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const name = C.ROOT_FOLDER + '/_INDEKS/' + prefix + '_' + stamp + '.csv';
    return bridge('saveText', { filename: name, text: C.toCsv(records) })
      .then(() => log('Indeks disimpan: ' + name))
      .catch(e => log('Gagal menyimpan indeks: ' + e.message));
  }

  async function run(opts) {
    running = true; stopFlag = false; refreshPanel();
    const started = Date.now();
    const records = [];
    const stats = { ok: 0, skip: 0, dup: 0, fail: 0, filtered: 0 };
    const ctx = { seen: new Set(), done: new Set(), stats, fatal: null };
    const range = C.dateRange(opts.range, opts.from, opts.to);
    const klas = C.parseList(opts.klas), kws = C.parseList(opts.keyword);
    const known = [], completed = [];
    const pool = new Set();
    let processed = 0;
    try {
      try { ctx.done = new Set(await bridge('getDone')); } catch (e) { log('Gagal membaca riwayat unduhan: ' + e.message); }
      log('Mulai. Filter: ' + C.describeFilter(opts) + '. Riwayat: ' + ctx.done.size + ' file.');
      outer:
      for (const src of C.SOURCES.filter(s => opts.sources.includes(s.key))) {
        if (!templates[src.path] || !templates[src.path].size) { log('Lewati ' + src.label + ': halaman daftarnya belum pernah dibuka.'); continue; }
        log('Membaca ' + src.label + ' ...');
        for await (const row of iterateRows(src, opts.rows, Math.min(opts.delay, 1000))) {
          if (stopFlag || ctx.fatal) break outer;
          known.push(C.knownKey(src, row));
          const it = C.normalizeRow(src, row);
          if (!C.inRange(it, range) || !C.matchKeyword(it, kws)) { stats.filtered++; continue; }
          const kl = C.resolveKlasifikasi(it, await klasifikasi(it.klasifikasiId));
          if (!C.matchKlas(kl.kode, klas)) { stats.filtered++; continue; }
          if (opts.limit && processed >= opts.limit) break outer;
          processed++;
          const rec = newRec(it, kl);
          records.push(rec);
          let p;
          p = (async () => { try { await processItem(it, rec, ctx); setStats(stats, processed); } finally { pool.delete(p); } })();
          pool.add(p);
          if (pool.size >= opts.conc) await Promise.race(pool);
          await sleep(opts.delay);
        }
        await Promise.all(pool);
        if (!stopFlag && !ctx.fatal && !(opts.limit && processed >= opts.limit)) completed.push(src.key);
      }
    } catch (e) {
      log('Berhenti karena galat: ' + e.message);
    } finally {
      // Indeks dan catatan tetap disimpan walau proses berhenti di tengah (temuan audit #4).
      await Promise.all(pool);
      if (ctx.fatal) log('Berhenti: ' + ctx.fatal.message);
      try { await bridge('addKnown', { keys: known, baseline: completed }); } catch (e) { /* abaikan */ }
      await saveIndex(records, 'INDEKS_ARSIP');
      const menit = ((Date.now() - started) / 60000).toFixed(1);
      log('Selesai dalam ' + menit + ' menit. Berhasil ' + stats.ok + ', sudah ada/dilewati ' + stats.skip + ', duplikat ' + stats.dup + ', gagal ' + stats.fail + ', tidak cocok filter ' + stats.filtered + '.');
      running = false; refreshPanel();
    }
  }

  /* ---------- 6. Periksa naskah baru ---------- */
  const CHECK_MAX_PAGES = 5;   // sampai 250 naskah terbaru per daftar

  async function runCheck(payload) {
    const out = { newItems: [], downloaded: 0, failed: 0, error: null, manual: !!payload.manual };
    if (running) { out.error = 'busy'; return out; }
    running = true; refreshPanel();
    const records = [];
    try {
      await waitSession(60000);
      const kv = await bridge('getKV', { keys: ['srk_known', 'srk_baseline', 'srk_retry'] });
      const known = new Set(kv.srk_known || []), baseline = new Set(kv.srk_baseline || []), retry = new Set(kv.srk_retry || []);
      const addKnown = [], newBaseline = [], retryAdd = [], retryDel = [];
      const ctx = { seen: new Set(), done: new Set(await bridge('getDone')), stats: { ok: 0, skip: 0, dup: 0, fail: 0 }, fatal: null };
      const range = C.dateRange(settings.range, settings.from, settings.to);
      const klas = C.parseList(settings.klas), kws = C.parseList(settings.keyword);
      for (const src of C.SOURCES.filter(s => settings.sources.includes(s.key))) {
        if (!templates[src.path] || !templates[src.path].size) continue;
        const isBase = !baseline.has(src.key);
        for (const t of templates[src.path].values()) {
          let cursor = null;
          for (let page = 0; page < CHECK_MAX_PAGES; page++) {
            const u = new URL(t); u.searchParams.set('rows', '50');
            if (cursor) u.searchParams.set('cursor', cursor);
            const pg = rowsOf(await api(u.toString()));
            let fresh = 0;
            for (const row of pg.rows) {
              const k = C.knownKey(src, row);
              const isNew = !known.has(k), isRetry = retry.has(k);
              if (!isNew && !isRetry) continue;
              fresh++;
              if (isNew) { known.add(k); addKnown.push(k); }
              if (isBase) continue;
              const it = C.normalizeRow(src, row);
              const kl = C.resolveKlasifikasi(it, await klasifikasi(it.klasifikasiId));
              const rec = newRec(it, kl);
              if (settings.autoDownload) {
                // Unduh otomatis mengikuti filter yang sama dengan unduhan manual (temuan audit #1).
                if (C.inRange(it, range) && C.matchKeyword(it, kws) && C.matchKlas(kl.kode, klas)) {
                  await processItem(it, rec, ctx);
                  records.push(rec);
                  // Unduhan gagal dicoba lagi pada pemeriksaan berikutnya (temuan audit #3).
                  if (rec.result === 'GAGAL') retryAdd.push(k); else if (isRetry) retryDel.push(k);
                } else { rec.result = 'TIDAK COCOK FILTER'; if (isRetry) retryDel.push(k); }
              }
              if (ctx.fatal) throw ctx.fatal;
              if (isNew) out.newItems.push({ group: it.group, sourceShort: it.sourceShort, kode: kl.kode, nomor: it.nomor, hal: it.hal, tanggal: it.tanggal, result: rec.result || 'BARU' });
            }
            cursor = pg.next;
            // Lanjut ke halaman berikutnya hanya bila halaman ini masih berisi naskah baru (temuan audit #2).
            if (!cursor || fresh === 0 || isBase) break;
          }
        }
        if (isBase) newBaseline.push(src.key);
      }
      await bridge('addKnown', { keys: addKnown, baseline: newBaseline });
      if (retryAdd.length || retryDel.length) await bridge('updRetry', { add: retryAdd, remove: retryDel });
      out.downloaded = ctx.stats.ok; out.failed = retryAdd.length;
      log('Pemeriksaan: ' + out.newItems.length + ' naskah baru' + (out.downloaded ? ', ' + out.downloaded + ' diunduh' : '') +
        (out.failed ? ', ' + out.failed + ' gagal (dicoba lagi nanti)' : '') +
        (newBaseline.length ? '. Data awal dicatat untuk: ' + newBaseline.join(', ') : '') + '.');
    } catch (e) {
      out.error = /Sesi|401|403/.test(e.message) ? 'session' : e.message;
      log('Pemeriksaan gagal: ' + e.message);
    } finally {
      await saveIndex(records, 'INDEKS_PANTAU');   // unduh otomatis juga tercatat di indeks (temuan audit #4)
      running = false; refreshPanel();
    }
    return out;
  }

  /* ---------- 7. Panel ---------- */
  let panel, logBox, statBox;
  const $ = s => panel && panel.querySelector(s);
  function el(tag, attrs, text) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (text != null) e.textContent = text; return e; }
  function opt(sel, pairs) { pairs.forEach(([v, t]) => sel.appendChild(el('option', { value: v }, t))); return sel; }
  function row(...kids) { const r = el('div', { className: 'row' }); r.append(...kids); return r; }
  function log(msg) {
    if (!logBox) return;
    logBox.appendChild(el('div', {}, new Date().toLocaleTimeString('id-ID') + '  ' + msg));
    while (logBox.childNodes.length > 500) logBox.removeChild(logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
  }
  function setStats(s, n) { if (statBox) statBox.textContent = 'Diproses ' + n + ' | Berhasil ' + s.ok + ' | Lewati ' + s.skip + ' | Duplikat ' + s.dup + ' | Gagal ' + s.fail; }

  function refreshPanel() {
    if (!panel) return;
    const st = $('#srk-session');
    st.textContent = session ? 'Sesi SRIKANDI: terdeteksi' : 'Sesi SRIKANDI: belum terdeteksi, buka halaman daftar naskah';
    st.style.color = session ? '#0a7d33' : '#b45309';
    C.SOURCES.forEach(s => {
      const b = $('#srk-st-' + s.key);
      const n = templates[s.path] ? templates[s.path].size : 0;
      b.textContent = n ? 'siap' : 'buka sekali';
      b.style.background = n ? '#d1fae5' : '#fef3c7';
    });
    $('#srk-go').disabled = running; $('#srk-stop').disabled = !running; $('#srk-check').disabled = running;
    const lc = $('#srk-last');
    if (lastCheck) lc.textContent = 'Pemeriksaan terakhir: ' + new Date(lastCheck.at).toLocaleString('id-ID') + (lastCheck.error ? ' (gagal: ' + lastCheck.error + ')' : ', ' + lastCheck.n + ' naskah baru');
  }

  function readPanel() {
    return {
      sources: C.SOURCES.filter(s => $('#srk-cb-' + s.key).checked).map(s => s.key),
      range: $('#srk-range').value, from: $('#srk-from').value, to: $('#srk-to').value,
      klas: $('#srk-klas').value, keyword: $('#srk-kw').value,
      layout: $('#srk-layout').value,
      conc: Number($('#srk-conc').value) || 2,
      delay: Math.max(300, Number($('#srk-delay').value) || 800),
      rows: 50,
      monitor: $('#srk-mon').value, dailyAt: $('#srk-daily').value || '07:30',
      autoDownload: $('#srk-autodl').checked, autoOpenTab: $('#srk-autotab').checked, notifDetail: $('#srk-ndetail').checked
    };
  }

  function fillPanel() {
    if (!panel) return;
    C.SOURCES.forEach(s => { $('#srk-cb-' + s.key).checked = settings.sources.includes(s.key); });
    $('#srk-range').value = settings.range; $('#srk-from').value = settings.from; $('#srk-to').value = settings.to;
    $('#srk-klas').value = settings.klas; $('#srk-kw').value = settings.keyword;
    $('#srk-layout').value = settings.layout; $('#srk-conc').value = String(settings.conc); $('#srk-delay').value = settings.delay;
    $('#srk-mon').value = settings.monitor; $('#srk-daily').value = settings.dailyAt;
    $('#srk-autodl').checked = settings.autoDownload; $('#srk-autotab').checked = settings.autoOpenTab; $('#srk-ndetail').checked = settings.notifDetail;
    toggleFields(); refreshPanel();
  }

  function toggleFields() {
    const custom = $('#srk-range').value === 'custom';
    $('#srk-custom').style.display = custom ? 'flex' : 'none';
    $('#srk-dailyrow').style.display = $('#srk-mon').value === 'daily' ? 'flex' : 'none';
  }

  async function saveSettings() {
    settings = readPanel(); toggleFields();
    try { await bridge('setKV', { obj: { srk_settings: settings } }); await bridge('applySchedule'); }
    catch (e) { log('Gagal menyimpan pengaturan: ' + e.message); }
  }

  function buildPanel() {
    if (panel || !document.body || !document.head) return;
    ['srk-fab', 'srk-panel', 'srk-css'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    document.head.appendChild(el('style', { id: 'srk-css' }, `
      #srk-fab{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#047D78;color:#fff;border:0;border-radius:24px;padding:10px 16px;font:600 13px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}
      #srk-panel{position:fixed;right:18px;bottom:66px;width:460px;max-height:84vh;overflow:auto;z-index:2147483647;background:#fff;color:#111;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:13px system-ui;padding:14px;display:none}
      #srk-panel h3{margin:0 0 4px;font-size:15px;color:#047D78}
      #srk-panel h4{margin:12px 0 4px;font-size:12px;color:#fff;background:#047D78;padding:3px 8px;border-radius:4px}
      #srk-panel h4.mon{background:#7f8a00}
      #srk-panel .row{display:flex;align-items:center;gap:6px;margin:4px 0;flex-wrap:wrap}
      #srk-panel .tag{font-size:11px;padding:1px 6px;border-radius:8px;margin-left:auto}
      #srk-panel a{color:#047D78}
      #srk-panel input[type=number]{width:70px;padding:2px 4px}
      #srk-panel input[type=text]{flex:1;min-width:150px;padding:3px 5px}
      #srk-panel select,#srk-panel input[type=date],#srk-panel input[type=time]{padding:2px 4px}
      #srk-panel button.act{padding:6px 12px;border-radius:6px;border:0;font-weight:600;cursor:pointer}
      #srk-panel button.act:disabled{opacity:.5;cursor:default}
      #srk-log{height:170px;overflow:auto;background:#0f172a;color:#e2e8f0;font:11px ui-monospace,monospace;padding:6px;border-radius:6px;margin-top:8px;white-space:pre-wrap}
      #srk-panel .note{font-size:11px;color:#475569}
      #srk-panel .credit{white-space:pre-line;font-size:10.5px;line-height:1.45;color:#64748b;border-top:1px solid #e2e8f0;margin-top:10px;padding-top:8px}
      #srk-panel .sub{font-size:12px;color:#047D78;margin:-2px 0 4px}`));

    const fab = el('button', { id: 'srk-fab', title: 'JALA Arsip: salinan arsip pribadi pengguna SRIKANDI' });
    fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-4px;margin-right:6px"><path d="M8 2.6 L3 11.6 M8 2.6 L13 11.6 M8 2.6 V12.3 M4.9 8.2 Q8 9.4 11.1 8.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="3.2" cy="12.2" r="1.7" fill="#CDDC29"/><circle cx="8" cy="13.1" r="1.7" fill="#CDDC29"/><circle cx="12.8" cy="12.2" r="1.7" fill="#CDDC29"/></svg>JALA';
    panel = el('div', { id: 'srk-panel' });
    panel.append(el('h3', {}, 'JALA Arsip v1.3'),
      el('div', { className: 'sub' }, 'Salinan arsip pribadi untuk pengguna SRIKANDI'),
      el('div', { className: 'note' }, 'Hanya membaca. Salinan PDF disimpan di Downloads/' + C.ROOT_FOLDER + '.'),
      el('div', { id: 'srk-session', className: 'row' }));

    // Sumber
    panel.append(el('h4', {}, '1. Sumber naskah'));
    C.SOURCES.forEach(s => {
      const cb = el('input', { type: 'checkbox', id: 'srk-cb-' + s.key, checked: true });
      panel.append(row(cb, el('label', { htmlFor: cb.id }, s.group + ' / ' + s.label), el('a', { href: s.page, title: 'Buka halaman ini' }, 'buka'), el('span', { id: 'srk-st-' + s.key, className: 'tag' })));
    });

    // Filter unduhan
    panel.append(el('h4', {}, '2. Yang diunduh'));
    const range = opt(el('select', { id: 'srk-range' }), [['all', 'Semua naskah'], ['year', 'Tahun ini'], ['month', 'Bulan ini'], ['week', 'Minggu ini'], ['30d', '30 hari terakhir'], ['custom', 'Pilih tanggal...']]);
    panel.append(row(el('span', {}, 'Rentang tanggal'), range));
    const custom = row(el('span', {}, 'Dari'), el('input', { type: 'date', id: 'srk-from' }), el('span', {}, 'sampai'), el('input', { type: 'date', id: 'srk-to' }));
    custom.id = 'srk-custom'; panel.append(custom);
    panel.append(row(el('span', {}, 'Kode klasifikasi'), el('input', { type: 'text', id: 'srk-klas', placeholder: 'kosong = semua. Contoh: PP, HK.02, KP.01.01' })));
    panel.append(row(el('span', {}, 'Kata kunci hal'), el('input', { type: 'text', id: 'srk-kw', placeholder: 'kosong = semua. Contoh: surat tugas, undangan' })));
    const layout = opt(el('select', { id: 'srk-layout' }), [['year', 'Tahun / Kelompok / Klasifikasi'], ['month', 'Tahun / Bulan / Kelompok / Klasifikasi']]);
    panel.append(row(el('span', {}, 'Susunan folder'), layout));
    const conc = opt(el('select', { id: 'srk-conc' }), [['1', '1'], ['2', '2'], ['3', '3']]);
    panel.append(row(el('span', {}, 'Unduhan bersamaan'), conc, el('span', {}, 'Jeda (ms)'), el('input', { type: 'number', id: 'srk-delay', value: 800, min: 300 })));
    const test = el('input', { type: 'checkbox', id: 'srk-test', checked: true });
    panel.append(row(test, el('label', { htmlFor: 'srk-test' }, 'Mode uji: berhenti setelah 5 naskah')));
    const go = el('button', { id: 'srk-go', className: 'act', style: 'background:#047D78;color:#fff' }, 'Mulai unduh');
    const stop = el('button', { id: 'srk-stop', className: 'act', style: 'background:#e2e8f0' }, 'Berhenti');
    panel.append(row(go, stop), el('div', { className: 'note' }, 'Riwayat unduhan diatur di halaman Opsi: klik kanan ikon JALA Arsip di toolbar Chrome, lalu pilih Opsi.'));

    // Pemantauan
    panel.append(el('h4', { className: 'mon' }, '3. Pantau naskah baru otomatis'));
    const mon = opt(el('select', { id: 'srk-mon' }), [['off', 'Mati'], ['30', 'Setiap 30 menit'], ['60', 'Setiap 1 jam'], ['180', 'Setiap 3 jam'], ['360', 'Setiap 6 jam'], ['daily', 'Sekali sehari']]);
    panel.append(row(el('span', {}, 'Periksa'), mon));
    const dailyRow = row(el('span', {}, 'Pukul'), el('input', { type: 'time', id: 'srk-daily', value: '07:30' }));
    dailyRow.id = 'srk-dailyrow'; panel.append(dailyRow);
    const autodl = el('input', { type: 'checkbox', id: 'srk-autodl' });
    panel.append(row(autodl, el('label', { htmlFor: 'srk-autodl' }, 'Langsung unduh naskah baru ke folder arsip')));
    const autotab = el('input', { type: 'checkbox', id: 'srk-autotab', checked: true });
    panel.append(row(autotab, el('label', { htmlFor: 'srk-autotab' }, 'Buka tab SRIKANDI di latar belakang bila tertutup')));
    const ndet = el('input', { type: 'checkbox', id: 'srk-ndetail', checked: true });
    panel.append(row(ndet, el('label', { htmlFor: 'srk-ndetail' }, 'Tampilkan perihal naskah di notifikasi (matikan bila sering berbagi layar)')));
    const checkBtn = el('button', { id: 'srk-check', className: 'act', style: 'background:#7f8a00;color:#fff' }, 'Periksa sekarang');
    const testN = el('button', { id: 'srk-testn', className: 'act', style: 'background:#fff;border:1px solid #cbd5e1' }, 'Tes notifikasi');
    panel.append(row(checkBtn, testN), el('div', { id: 'srk-last', className: 'note' }, 'Belum pernah memeriksa'),
      el('div', { className: 'note' }, 'Pemeriksaan berjalan selama komputer menyala, Chrome terbuka, dan sesi SRIKANDI masih aktif. Pemeriksaan pertama per sumber hanya mencatat data awal tanpa notifikasi.'));

    statBox = el('div', { className: 'note', style: 'margin-top:8px' }, 'Belum berjalan');
    logBox = el('div', { id: 'srk-log' });
    panel.append(statBox, logBox,
      el('div', { className: 'credit' }, 'Dikembangkan oleh Deddy Eko Heryanto, S.T.\nJFT Pranata Komputer Ahli Muda, Perpustakaan Poltekkes Kemenkes Palangka Raya\nAlat arsip pribadi. Bukan produk resmi ANRI.'));

    // Peristiwa
    fab.onclick = () => { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; refreshPanel(); };
    panel.querySelectorAll('input,select').forEach(x => { if (x.id !== 'srk-test') x.addEventListener('change', saveSettings); });
    go.onclick = () => {
      if (running) return;
      if (!session) { log('Sesi belum terdeteksi. Buka salah satu halaman daftar naskah, lalu coba lagi.'); return; }
      settings = readPanel();
      const o = Object.assign({}, settings, { limit: test.checked ? 5 : 0 });
      if (o.range === 'custom' && o.from && o.to && o.from > o.to) { log('Tanggal "dari" lebih besar dari "sampai".'); return; }
      run(o).catch(e => { log('Berhenti: ' + e.message); running = false; refreshPanel(); });
    };
    stop.onclick = () => { stopFlag = true; log('Menghentikan setelah naskah yang sedang diproses...'); };
    checkBtn.onclick = async () => {
      if (running) return;
      log('Memeriksa naskah baru...');
      const r = await runCheck({ manual: true });
      try { await bridge('checkResult', r); } catch (e) { /* abaikan */ }
      lastCheck = { at: Date.now(), n: r.newItems.length, error: r.error }; refreshPanel();
    };
    testN.onclick = () => bridge('testNotify').then(() => log('Notifikasi uji dikirim. Kalau tidak muncul, cek izin notifikasi Chrome di pengaturan Windows.')).catch(e => log('Gagal: ' + e.message));

    document.body.append(fab, panel);
    fillPanel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildPanel);
  else buildPanel();
  setInterval(() => {
    if (!document.body) return;
    if (panel && !document.body.contains(panel)) panel = null;
    if (!panel) buildPanel();
  }, 1500);
})();
