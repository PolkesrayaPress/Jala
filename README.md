<p align="center"><img src="docs/assets/jala-icon.svg" width="96" alt="Ikon JALA"></p>

<h1 align="center">JALA Arsip</h1>

<p align="center"><b>Jaring Arsip Lokal Otomatis</b>, salinan arsip pribadi untuk pengguna SRIKANDI</p>

<p align="center">Ekstensi Chrome untuk menyalin naskah SRIKANDI Anda sendiri ke laptop, tersusun per tahun dan klasifikasi, dengan notifikasi naskah baru.</p>

---

## Untuk siapa

JALA adalah **alat arsip pribadi** bagi setiap pengguna SRIKANDI. Setiap orang memasang JALA di Chrome-nya sendiri, login ke SRIKANDI dengan akunnya sendiri, dan menyimpan salinan naskahnya di laptopnya sendiri.

- JALA tidak meminta, tidak menyimpan, dan tidak mengirim kata sandi.
- JALA hanya bisa menyalin naskah yang memang bisa dilihat oleh akun pemakainya.
- JALA hanya membaca. Tidak ada fungsi tanda tangan, verifikasi, disposisi, pemberkasan, atau hapus.

## Fitur

| Fitur | Keterangan |
|---|---|
| Unduh massal | Daftar Naskah Masuk, Tembusan, Disposisi/Koordinasi/Arahan, Naskah Keluar, Verifikasi, Tandatangan |
| Susunan folder | `SRIKANDI_ARSIP/Tahun/[Bulan/]Kelompok/Kode - Nama Klasifikasi/` |
| Filter | Rentang tanggal (semua, tahun, bulan, minggu, 30 hari, kustom), awalan kode klasifikasi, kata kunci hal |
| Indeks | CSV untuk setiap unduhan manual dan setiap pemeriksaan yang mengunduh, termasuk bila proses terhenti di tengah. Isian yang diawali `=`, `+`, `-`, `@` dinetralkan agar aman dibuka di Excel |
| Pemantauan | Pemeriksaan berkala (30 menit sampai harian) atas sampai 250 naskah terbaru per daftar, notifikasi desktop (perihal bisa disembunyikan), opsi unduh otomatis yang mengikuti filter, coba ulang unduhan gagal |
| Lanjut otomatis | File yang sudah diunduh tidak diunduh ulang |

## Instalasi singkat

> **ID ekstensi tetap: `bgpfanedbfemacdgbgbnhmjmgaaahagp`.** Memasang dari folder lain menggantikan JALA 1.4 atau lebih baru yang sudah terpasang. Hapus dulu versi sebelum 1.4 di `chrome://extensions`, karena versi lama memakai ID berbeda dan akan tetap terpasang berdampingan.


1. Unduh [`docs/download/jala-arsip-v1.4.1.zip`](docs/download/jala-arsip-v1.4.1.zip), lalu ekstrak ke folder tetap, misalnya `Documents\jala`.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder `jala`.
3. Login ke SRIKANDI, tekan F5, lalu klik tombol **JALA** di kanan bawah.

Panduan lengkap dan video ada di situs dokumentasi (folder `docs/`) dan di [`extension/BACA-DULU.md`](extension/BACA-DULU.md).

## Batas operasi

| Kondisi | Yang terjadi |
|---|---|
| Pindah tab atau membuka Word | Tetap berjalan, tab latar belakang bisa lebih lambat |
| Tab SRIKANDI ditutup saat unduh massal | Antrean berhenti. Klik Mulai unduh lagi, file yang sudah ada dilewati |
| Tab tertutup saat jadwal pemeriksaan | Bila opsi aktif, JALA membuka tab SRIKANDI di latar belakang, memeriksa, lalu menutupnya |
| Sesi SRIKANDI habis | Notifikasi "Sesi SRIKANDI habis". Login ulang secara manual |
| Chrome ditutup atau laptop tidur | Tidak ada pemeriksaan. Dilanjutkan pada jadwal berikutnya |

## Keamanan

- Header sesi hanya dikirim ke `https://api.arsip.go.id`. Alamat lain ditolak sebelum permintaan dibuat.
- Unduhan hanya diterima dari `https://s3.arsip.go.id` dan hanya ke dalam folder `SRIKANDI_ARSIP`.
- Halaman web hanya bisa mengubah pengaturan yang sudah divalidasi. Menghapus, mengekspor, dan mengimpor riwayat hanya bisa dari halaman Opsi ekstensi.
- Token sesi dikunci pada token pertama di setiap halaman. Bila token berubah, JALA berhenti dan meminta halaman dimuat ulang.
- Hanya lima jenis permintaan baca ke `api.arsip.go.id` yang diizinkan (daftar naskah, master klasifikasi, alamat unduhan, isi berkas naskah masuk). Permintaan lain ditolak sebelum dikirim.
- Tidak ada layanan AI, server perantara, atau analitik.

## Struktur repositori

```
extension/        kode ekstensi Chrome (Manifest V3)
docs/             situs dokumentasi untuk GitHub Pages
  index.html
  assets/         gaya, skrip, ikon, huruf (di-hosting sendiri)
  media/          video panduan, poster, takarir
  download/       paket ZIP siap pasang
LICENSE
```

## Menerbitkan situs dengan GitHub Pages

1. Unggah isi repositori ini ke GitHub.
2. Buka **Settings > Pages**, pilih **Deploy from a branch**, branch `main`, folder `/docs`, lalu klik Save.
3. Situs tersedia di `https://<nama-akun>.github.io/<nama-repo>/` dalam beberapa menit.

## Pengembang

**Deddy Eko Heryanto, S.T.**
JFT Pranata Komputer Ahli Muda, Perpustakaan Poltekkes Kemenkes Palangka Raya

## Riwayat versi

- **1.4.1**: judul bagian panel dan halaman Opsi berwarna kuning seragam dengan tulisan hitam; halaman Opsi mengikuti tema terang/gelap; perbaikan tautan unduhan di README.
- **1.4.0**: gabungan dengan revisi ChatGPT 1.3.0. ID ekstensi tetap (bgpfanedbfemacdgbgbnhmjmgaaahagp); peringatan bila ada dua JALA terpasang; ekspor/impor riwayat; token sesi dikunci per halaman (menutup celah injeksi token yang ada di 1.3.1 maupun kandidat ChatGPT 1.3.0); validasi API per metode dan path, `redirect: error`, `credentials: omit`; Stop membatalkan permintaan; coba ulang maksimal 5 kali dengan jeda 30 sampai 240 menit; service worker menandai unduhan selesai dan merekonsiliasi setelah hidup ulang; maksimal 100 unduhan otomatis per pemeriksaan; PDF menimpa berkas bernama sama.
- **1.3.1**: panel mengikuti warna situs dengan pilihan tema terang/gelap, judul bagian kuning dan oranye bertulisan hitam; kotak kuning alamat chrome://extensions/ di situs.
- **1.3.0**: nama menjadi JALA Arsip; perbaikan hasil audit independen (keamanan pesan dan API, penulisan riwayat berurutan, pemantauan multi-halaman, coba ulang, filter dan indeks untuk unduh otomatis, netralisasi formula CSV, opsi privasi notifikasi, halaman Opsi).
- **1.2.0**: nama JALA, ikon, situs dokumentasi, video panduan.
- **1.1.0**: filter, pemantauan terjadwal, notifikasi desktop.
- **1.0.0**: unduhan massal per tahun dan klasifikasi.

## Lisensi dan pernyataan

Kode dirilis dengan lisensi MIT (lihat [LICENSE](LICENSE)). Huruf Bricolage Grotesque dan Atkinson Hyperlegible Next memakai SIL Open Font License.

SRIKANDI adalah aplikasi milik Arsip Nasional Republik Indonesia (ANRI). JALA dibuat secara mandiri, bukan produk resmi ANRI, dan tidak berafiliasi dengan pengelola SRIKANDI. Salinan yang dibuat JALA adalah cadangan pribadi dan tidak menggantikan pemberkasan arsip resmi di SRIKANDI.
