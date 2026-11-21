/* Halaman opsi JALA Arsip: hanya dapat diakses dari dalam Chrome. */
'use strict';
const send = (type, payload) => new Promise((res, rej) => chrome.runtime.sendMessage({ type, payload }, r => (r && r.ok ? res(r.data) : rej(new Error((r && r.error) || 'gagal')))));
const msg = t => { document.getElementById('msg').textContent = t; };

// Tema mengikuti pilihan di panel JALA (srk_settings.theme); "auto" mengikuti sistem.
let theme = 'auto';
function applyTheme() {
  const t = theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme').textContent = t === 'dark' ? 'Tema terang' : 'Tema gelap';
}
chrome.storage.local.get('srk_settings').then(o => { theme = (o.srk_settings && o.srk_settings.theme) || 'auto'; applyTheme(); });
document.getElementById('theme').addEventListener('click', async () => {
  theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; applyTheme();
  const o = await chrome.storage.local.get('srk_settings');
  await chrome.storage.local.set({ srk_settings: Object.assign({}, o.srk_settings || {}, { theme }) });
});

async function load() {
  const s = await send('stats');
  document.getElementById('ver').textContent = 'Versi ' + s.version + ', ID ekstensi ' + s.id;
  const rows = [['File tercatat sudah diunduh', s.done], ['Naskah tercatat sudah dilihat', s.known], ['Menunggu unduh ulang', s.retry], ['Gagal 5 kali (perlu unduh manual)', s.dead], ['Alamat daftar dikenal', s.templates],
    ['Pemeriksaan terakhir', s.last ? new Date(s.last.at).toLocaleString('id-ID') + (s.last.error ? ' (gagal: ' + s.last.error + ')' : ', ' + s.last.n + ' naskah baru') : 'belum pernah']];
  const dl = document.getElementById('stats'); dl.textContent = '';
  rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = String(v); dl.append(dt, dd); });
}

const act = (id, question, done) => document.getElementById(id).addEventListener('click', async () => {
  if (!confirm(question)) return;
  try { await send(id); msg(done); load(); } catch (e) { msg('Gagal: ' + e.message); }
});
act('resetDone', 'Lupakan riwayat unduhan? File di laptop tidak dihapus.', 'Riwayat unduhan dikosongkan.');
act('resetKnown', 'Ulangi data awal pemantauan?', 'Data awal pemantauan akan dicatat ulang pada pemeriksaan berikutnya.');
act('resetTemplates', 'Lupakan alamat daftar? Anda perlu membuka lagi setiap daftar naskah sekali.', 'Alamat daftar dikosongkan.');
load().catch(e => msg('Gagal memuat: ' + e.message));

document.getElementById('export').addEventListener('click', async () => {
  try {
    const data = await send('exportData');
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'JALA-Arsip-riwayat-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    msg('Riwayat diekspor ke folder Downloads.');
  } catch (e) { msg('Gagal: ' + e.message); }
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    if (f.size > 50 * 1024 * 1024) throw new Error('Berkas terlalu besar');
    const r = await send('importData', JSON.parse(await f.text()));
    msg('Riwayat digabung. Sekarang tercatat ' + r.done + ' file sudah diunduh.'); load();
  } catch (e) { msg('Gagal impor: ' + e.message); }
  ev.target.value = '';
});
