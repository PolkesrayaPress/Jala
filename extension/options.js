/* Halaman opsi JALA Arsip: hanya dapat diakses dari dalam Chrome. */
'use strict';
const send = (type) => new Promise((res, rej) => chrome.runtime.sendMessage({ type }, r => (r && r.ok ? res(r.data) : rej(new Error((r && r.error) || 'gagal')))));
const msg = t => { document.getElementById('msg').textContent = t; };

async function load() {
  const s = await send('stats');
  const rows = [['File tercatat sudah diunduh', s.done], ['Naskah tercatat sudah dilihat', s.known], ['Menunggu unduh ulang', s.retry], ['Alamat daftar dikenal', s.templates],
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
