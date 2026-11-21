<p align="center"><img src="docs/assets/jala-icon.svg" width="96" alt="Ikon JALA"></p>

<h1 align="center">JALA: Jaring Arsip Lokal Otomatis</h1>

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
| Indeks | CSV per proses, siap dibuka di Excel |
| Pemantauan | Pemeriksaan berkala (30 menit sampai harian), notifikasi desktop, angka di ikon, opsi unduh otomatis |
| Lanjut otomatis | File yang sudah diunduh tidak diunduh ulang |

## Instalasi singkat

1. Unduh [`docs/download/jala-v1.2.0.zip`](docs/download/jala-v1.2.0.zip), lalu ekstrak ke folder tetap, misalnya `Documents\jala`.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder `jala`.
3. Login ke SRIKANDI, tekan F5, lalu klik tombol **JALA** di kanan bawah.

Panduan lengkap dan video ada di situs dokumentasi (folder `docs/`) dan di [`extension/BACA-DULU.md`](extension/BACA-DULU.md).

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

## Lisensi dan pernyataan

Kode dirilis dengan lisensi MIT (lihat [LICENSE](LICENSE)). Huruf Bricolage Grotesque dan Atkinson Hyperlegible Next memakai SIL Open Font License.

SRIKANDI adalah aplikasi milik Arsip Nasional Republik Indonesia (ANRI). JALA dibuat secara mandiri, bukan produk resmi ANRI, dan tidak berafiliasi dengan pengelola SRIKANDI. Salinan yang dibuat JALA adalah cadangan pribadi dan tidak menggantikan pemberkasan arsip resmi di SRIKANDI.
