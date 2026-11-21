/* JALA (Jaring Arsip Lokal Otomatis) - fungsi murni (tanpa akses jaringan).
 * Dipakai oleh agent.js (halaman), background.js (service worker), dan diuji dengan Node. */
(function (root) {
  'use strict';

  const ROOT_FOLDER = 'SRIKANDI_ARSIP';
  const LIST_URL = 'https://srikandi.arsip.go.id/penerimaan-naskah-masuk/naskah-dinas-masuk';

  // Sumber daftar naskah yang dipetakan dari lalu lintas SRIKANDI (21 Nov 2026).
  const SOURCES = [
    { key: 'masuk',      label: 'Daftar Naskah Masuk',         short: 'Masuk',      group: 'Naskah Masuk',  path: '/naskah-masuk/api/naskah-dinas/naskah-masuk',   page: '/penerimaan-naskah-masuk/naskah-dinas-masuk' },
    { key: 'tembusan',   label: 'Tembusan',                    short: 'Tembusan',   group: 'Naskah Masuk',  path: '/naskah-masuk/api/naskah-dinas/masuk-tembusan', page: '/penerimaan-naskah-masuk/naskah-tembusan' },
    { key: 'disposisi',  label: 'Disposisi/Koordinasi/Arahan', short: 'Disposisi',  group: 'Naskah Masuk',  path: '/naskah-masuk/api/naskah-dinas/disposisi/list',  page: '/penerimaan-naskah-masuk/disposisi', viaNaskahMasuk: true },
    { key: 'keluar',     label: 'Daftar Naskah Keluar',        short: 'Keluar',     group: 'Naskah Keluar', path: '/naskah-keluar/api/naskah-dinas/naskah-keluar', page: '/pembuatan-naskah-keluar/naskah-keluar' },
    { key: 'verifikasi', label: 'Verifikasi Naskah',           short: 'Verifikasi', group: 'Naskah Keluar', path: '/naskah-keluar/api/verifikator-naskah',         page: '/pembuatan-naskah-keluar/verifikasi-naskah' },
    { key: 'ttd',        label: 'Tandatangan Naskah',          short: 'Tandatangan', group: 'Naskah Keluar', path: '/naskah-keluar/api/penandatangan-naskah/list',  page: '/pembuatan-naskah-keluar/tandatangan-naskah' }
  ];

  const DEFAULT_SETTINGS = {
    sources: SOURCES.map(s => s.key),
    range: 'all',          // all | year | month | week | 30d | custom
    from: '', to: '',      // YYYY-MM-DD untuk custom
    klas: '',              // awalan kode klasifikasi, pisahkan koma
    keyword: '',           // kata kunci pada hal/nomor, pisahkan koma
    layout: 'year',        // year | month
    conc: 2,               // unduhan bersamaan
    delay: 800,            // jeda antar naskah (ms)
    rows: 50,
    monitor: 'off',        // off | 30 | 60 | 180 | 360 | daily
    dailyAt: '07:30',
    autoDownload: false,
    autoOpenTab: true
  };

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Karakter yang dilarang Windows di nama file/folder diganti tanda hubung.
  function sanitize(s, max) {
    let t = String(s == null ? '' : s)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .trim()
      .replace(/^[.\s-]+|[.\s]+$/g, '');
    if (max && t.length > max) t = t.slice(0, max).replace(/[.\s-]+$/g, '');
    return t;
  }

  // Kode klasifikasi dari nomor naskah, mis. "PP.03.03/F.XLI/9311/2026" -> "PP.03.03".
  function kodeFromNomor(nomor) {
    const m = String(nomor || '').trim().match(/^([A-Z]{2}(?:\.\d{1,3}){0,3})(?=\/|\s|$)/);
    return m ? m[1] : null;
  }

  function dateOf(item) {
    const d = String(item.tanggal || item.createdAt || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }

  function yearOf(tanggal, fallback) {
    const m = String(tanggal || '').match(/^(\d{4})-\d{2}-\d{2}/) || String(fallback || '').match(/^(\d{4})/);
    return m ? m[1] : 'TANPA_TAHUN';
  }

  function extOf(file) {
    const m = String(file || '').match(/\.([A-Za-z0-9]{1,5})$/);
    return m ? m[1].toLowerCase() : 'pdf';
  }

  /* ---------- Filter ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // Rentang tanggal naskah (inklusif). null berarti semua.
  function dateRange(preset, from, to, now) {
    now = now ? new Date(now) : new Date();
    const today = ymd(now);
    switch (preset) {
      case 'year': return { from: now.getFullYear() + '-01-01', to: today };
      case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
      case 'week': { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: ymd(d), to: today }; }
      case '30d': { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: ymd(d), to: today }; }
      case 'custom': return { from: from || '0000-01-01', to: to || '9999-12-31' };
      default: return null;
    }
  }

  function inRange(item, range) {
    if (!range) return true;
    const d = dateOf(item);
    return !!d && d >= range.from && d <= range.to;
  }

  function parseList(s) {
    return String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  }

  function matchKlas(kode, prefixes) {
    if (!prefixes || !prefixes.length) return true;
    if (!kode) return false;
    const k = kode.toUpperCase();
    return prefixes.some(p => k.startsWith(p.toUpperCase()));
  }

  function matchKeyword(item, kws) {
    if (!kws || !kws.length) return true;
    const h = ((item.hal || '') + ' ' + (item.nomor || '')).toLowerCase();
    return kws.some(k => h.includes(k.toLowerCase()));
  }

  function describeFilter(o) {
    const r = { all: 'semua tanggal', year: 'tahun ini', month: 'bulan ini', week: 'minggu ini', '30d': '30 hari terakhir', custom: (o.from || 'awal') + ' s.d. ' + (o.to || 'sekarang') }[o.range] || 'semua tanggal';
    const parts = [r];
    if (parseList(o.klas).length) parts.push('klasifikasi ' + parseList(o.klas).join(', '));
    if (parseList(o.keyword).length) parts.push('kata kunci "' + parseList(o.keyword).join('", "') + '"');
    return parts.join('; ');
  }

  /* ---------- Normalisasi & penamaan ---------- */
  // Disposisi menyimpan naskah di tindak_lanjut.naskah_masuk.
  function normalizeRow(src, row) {
    row = row || {};
    let n = row;
    let naskahMasukId = null;
    if (src.viaNaskahMasuk) {
      const tl = Array.isArray(row.tindak_lanjut) ? row.tindak_lanjut[0] : row.tindak_lanjut;
      n = (tl && tl.naskah_masuk) || {};
      naskahMasukId = (tl && tl.naskah_masuk_id) || n.id || null;
    } else if (src.group === 'Naskah Masuk') {
      naskahMasukId = row.id;
    }
    return {
      source: src.key,
      sourceLabel: src.label,
      sourceShort: src.short,
      group: src.group,
      id: n.id != null ? n.id : row.id,
      naskahMasukId,
      nomor: n.nomor || '',
      tanggal: n.tanggal || '',
      createdAt: n.created_at || row.created_at || '',
      hal: n.hal || n.ringkasan || '',
      pihak: n.nama_pengirim || n.instansi_pengirim || n.nama_penerima || n.tujuan || '',
      status: n.status || row.status || '',
      klasifikasiId: n.klasifikasi_id || null,
      klasifikasiNama: n.klasifikasi_nama || '',
      file: n.file || null,
      filePath: n.file_path || null,
      otp: !!n.effective_otp_protected
    };
  }

  function resolveKlasifikasi(item, master) {
    if (master && master.kode) return { kode: master.kode, nama: master.nama || item.klasifikasiNama, asal: 'master SRIKANDI' };
    const k = kodeFromNomor(item.nomor);
    if (k) return { kode: k, nama: item.klasifikasiNama || '', asal: 'prefiks nomor naskah' };
    return { kode: null, nama: '', asal: 'tidak ada' };
  }

  function buildPath(item, kl, layout) {
    const year = yearOf(item.tanggal, item.createdAt);
    const d = dateOf(item);
    const klFolder = kl && kl.kode
      ? sanitize(kl.kode + (kl.nama ? ' - ' + kl.nama : ''), 70)
      : '_TANPA_KLASIFIKASI';
    const base = [
      item.tanggal ? item.tanggal.slice(0, 10) : 'tanpa-tanggal',
      sanitize(item.nomor, 50) || ('ID-' + item.id),
      sanitize(item.hal, 90)
    ].filter(Boolean).join('_');
    const parts = [ROOT_FOLDER, year];
    if (layout === 'month') parts.push(d ? d.slice(5, 7) + '-' + BULAN[Number(d.slice(5, 7)) - 1] : 'TANPA_BULAN');
    parts.push(item.group, klFolder, base + '.' + extOf(item.file));
    return parts.join('/');
  }

  function dedupKey(item) {
    return item.filePath && item.file ? item.filePath + '/' + item.file : item.source + ':' + item.id;
  }

  // Penanda baris daftar yang sudah pernah dilihat (untuk deteksi naskah baru).
  function knownKey(src, row) {
    return src.key + ':' + (row && row.id);
  }

  // Bersihkan alamat daftar yang dipelajari: hapus kursor, kosongkan pencarian & filter tampilan.
  function sanitizeTemplate(url) {
    const u = new URL(url);
    if (u.searchParams.get('is_count') === 'true') return null;
    u.searchParams.delete('cursor');
    [...u.searchParams.keys()].forEach(k => { if (k === 'search' || k.startsWith('filters[')) u.searchParams.set(k, ''); });
    return u.toString();
  }

  /* ---------- Jadwal & notifikasi ---------- */
  function nextDaily(hhmm, now) {
    const m = String(hhmm || '07:30').match(/^(\d{1,2}):(\d{2})$/);
    const h = m ? Math.min(23, Number(m[1])) : 7, mi = m ? Math.min(59, Number(m[2])) : 30;
    const n = now ? new Date(now) : new Date();
    const t = new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, mi, 0, 0);
    if (t.getTime() <= n.getTime()) t.setDate(t.getDate() + 1);
    return t.getTime();
  }

  function notifText(items) {
    // satu baris per nomor naskah (naskah yang sama bisa muncul di dua daftar)
    const seen = new Set(), uniq = [];
    items.forEach(i => { const k = i.nomor || i.hal; if (!seen.has(k)) { seen.add(k); uniq.push(i); } });
    const lines = uniq.slice(0, 3).map(i => (i.sourceShort || i.group) + ' | ' + (i.kode || (i.nomor || '').split('/')[0] || '-') + ' | ' + String(i.hal || '').slice(0, 60));
    if (uniq.length > 3) lines.push('+' + (uniq.length - 3) + ' naskah lainnya');
    return { count: uniq.length, title: 'SRIKANDI: ' + uniq.length + ' naskah baru', message: lines.join('\n') };
  }

  /* ---------- Indeks CSV ---------- */
  const CSV_COLS = ['No', 'Sumber', 'Kelompok', 'Tahun', 'Tanggal Naskah', 'Nomor', 'Hal', 'Pengirim/Pihak',
    'Kode Klasifikasi', 'Nama Klasifikasi', 'Asal Klasifikasi', 'Status', 'File di SRIKANDI', 'Lokasi Lokal', 'Hasil', 'Catatan'];

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(records) {
    const lines = [CSV_COLS.join(';')];
    records.forEach((r, i) => {
      lines.push([i + 1, r.sourceLabel, r.group, yearOf(r.tanggal, r.createdAt), r.tanggal, r.nomor, r.hal, r.pihak,
        r.kode || '', r.klNama || '', r.klAsal || '', r.status, r.file || '', r.localPath || '', r.result, r.note || '']
        .map(csvCell).join(';'));
    });
    return '﻿' + lines.join('\r\n');
  }

  const api = {
    ROOT_FOLDER, LIST_URL, SOURCES, DEFAULT_SETTINGS, BULAN,
    sanitize, kodeFromNomor, dateOf, yearOf, extOf,
    dateRange, inRange, parseList, matchKlas, matchKeyword, describeFilter,
    normalizeRow, resolveKlasifikasi, buildPath, dedupKey, knownKey, sanitizeTemplate,
    nextDaily, notifText, toCsv, CSV_COLS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__SRK_CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
