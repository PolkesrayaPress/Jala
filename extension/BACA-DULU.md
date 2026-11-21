# JALA Arsip v1.3: Jaring Arsip Lokal Otomatis

**Alat arsip pribadi untuk pengguna SRIKANDI.** Setiap pengguna memakai akun SRIKANDI-nya sendiri, dan salinan naskah tersimpan di laptopnya sendiri.

Dikembangkan oleh **Deddy Eko Heryanto, S.T.**, JFT Pranata Komputer Ahli Muda, Perpustakaan Poltekkes Kemenkes Palangka Raya.
JALA bukan produk resmi ANRI dan tidak berafiliasi dengan pengelola SRIKANDI.

Ekstensi Chrome untuk:
1. Mengunduh **salinan** PDF naskah dari akun SRIKANDI Anda sendiri, disusun per tahun (opsional per bulan), kelompok, dan klasifikasi.
2. **Memantau naskah baru** secara berkala dan menampilkan notifikasi di desktop.

Ekstensi ini **tidak memakai AI** dan tidak membutuhkan langganan apa pun. Semua aturannya tetap dan berjalan di Chrome Anda.

## 1. Memperbarui dari versi sebelumnya (SRIKANDI Arsip Agent)

1. Ekstrak ZIP ini, lalu **timpa** isi folder `srikandi-arsip-agent` yang lama.
2. Buka `chrome://extensions`, cari ekstensi lama, lalu klik ikon **muat ulang** (panah melingkar). Namanya akan berubah menjadi JALA Arsip.
3. Muat ulang tab SRIKANDI (F5).

Riwayat unduhan versi lama tetap dipakai, sehingga file yang sudah terunduh tidak diunduh ulang.

## 2. Pengaturan unduhan (panel bagian 2)

| Pengaturan | Pilihan | Keterangan |
|---|---|---|
| Sumber | 6 daftar | Centang daftar yang ingin diunduh |
| Rentang tanggal | Semua, Tahun ini, Bulan ini, Minggu ini (Senin s.d. hari ini), 30 hari terakhir, Pilih tanggal | Berdasarkan Tanggal Naskah di SRIKANDI |
| Kode klasifikasi | mis. `PP, HK.02, KP.01.01` | Mencocokkan awalan kode. Kosong berarti semua. Naskah tanpa kode tidak ikut kalau filter ini diisi |
| Kata kunci hal | mis. `surat tugas, undangan` | Dicari di Hal dan Nomor. Kosong berarti semua |
| Susunan folder | Tahun/Kelompok/Klasifikasi, atau Tahun/Bulan/Kelompok/Klasifikasi | Contoh bulan: `2026/11-November/` |
| Unduhan bersamaan | 1 sampai 3 | 2 adalah titik tengah antara kecepatan dan beban server |

Pengaturan tersimpan otomatis. Log menampilkan waktu tiap file (`url x dtk, unduh y dtk`) supaya mudah melihat bagian mana yang lambat.

## 3. Pemantauan naskah baru (panel bagian 3)

| Pengaturan | Keterangan |
|---|---|
| Periksa | Mati, setiap 30 menit, 1 jam, 3 jam, 6 jam, atau sekali sehari pada jam tertentu |
| Langsung unduh naskah baru | Kalau dicentang, naskah baru yang cocok dengan filter di bagian 2 langsung disimpan ke folder arsip dan dicatat di `INDEKS_PANTAU_*.csv`. Unduhan yang gagal dicoba lagi pada pemeriksaan berikutnya |
| Tampilkan perihal di notifikasi | Matikan bila sering berbagi layar. Notifikasi hanya menampilkan jumlah per daftar |
| Buka tab SRIKANDI di latar belakang | Kalau tab SRIKANDI tertutup, agen membuka tab tersemat, memeriksa, lalu menutupnya kembali |
| Periksa sekarang | Menjalankan pemeriksaan saat itu juga |
| Tes notifikasi | Memastikan notifikasi desktop muncul |

Cara kerjanya:
- Agen membaca naskah terbaru dari setiap daftar yang dicentang, halaman demi halaman sampai 250 naskah, dan berhenti begitu satu halaman tidak berisi naskah baru. Halaman detail tidak dibuka, sehingga status "dibaca" tidak berubah.
- **Pemeriksaan pertama** setiap daftar hanya mencatat data awal tanpa notifikasi. Proses "Mulai unduh" yang selesai penuh juga dihitung sebagai data awal.
- Notifikasi menampilkan jumlah naskah baru dan 3 contoh (sumber, kode, hal). Klik notifikasi atau ikon ekstensi untuk membuka SRIKANDI. Angka merah di ikon menunjukkan naskah baru yang belum dilihat.
- Disposisi baru atas naskah lama juga dilaporkan sebagai item baru di daftar Disposisi.

**Syarat agar pemeriksaan berjalan**
1. Komputer menyala (tidak tidur) dan **Chrome terbuka**.
2. **Sesi SRIKANDI masih aktif.** Agen tidak menyimpan kata sandi. Kalau sesi habis, muncul notifikasi "Sesi SRIKANDI habis" (paling sering sekali per 6 jam), lalu Anda perlu login ulang secara manual.
3. Izin notifikasi Chrome aktif di Windows: Settings, System, Notifications, Google Chrome = On. Pastikan juga mode Focus/Do not disturb tidak aktif.

## 4. Pemasangan pertama (kalau belum pernah)

1. Ekstrak ZIP ke folder tetap, misalnya `Documents\srikandi-arsip-agent`.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder tersebut.
3. Matikan "Ask where to save each file" di `chrome://settings/downloads`.
4. Login SRIKANDI, tekan F5, klik tombol **JALA**, lalu klik **buka** pada setiap sumber sampai semuanya berlabel **siap**. Alamat yang dipelajari disimpan, jadi langkah ini cukup sekali.

## 5. Batasan

- Cakupan mengikuti hak akses akun. Role *User* hanya melihat naskah yang ditujukan, ditembuskan, didisposisikan, atau dibuat oleh Anda.
- Naskah ber-OTP dilewati dan tercatat "DILEWATI" di indeks.
- Ini salinan cadangan, bukan pemberkasan resmi. Arsip dinamis yang sah tetap berada di Pemberkasan Arsip Aktif SRIKANDI.
- Selama unduhan penuh berjalan, jangan tutup tab SRIKANDI. Pindah tab atau membuka Word boleh, tetapi tab latar belakang bisa lebih lambat. Kalau tab tertutup, antrean berhenti; klik Mulai unduh lagi dan file yang sudah ada akan dilewati.
- Kalau SRIKANDI mengubah alamat API-nya, ekstensi perlu diperbarui.

## 6. Keamanan

- Hanya membaca. Agen tidak memanggil fungsi tanda tangan, verifikasi, disposisi, pemberkasan, atau hapus.
- Sesi login hanya disimpan di memori tab SRIKANDI. Yang disimpan di ekstensi hanyalah pengaturan, alamat daftar (tanpa sesi), dan daftar ID naskah yang sudah dilihat atau diunduh.
- Unduhan hanya diterima dari `s3.arsip.go.id`. Perintah hanya diterima dari halaman `srikandi.arsip.go.id`.
- Riwayat unduhan diatur di halaman **Opsi** (klik kanan ikon JALA Arsip, pilih Opsi). Menghapus riwayat tidak menghapus file di laptop.
- Header sesi hanya dikirim ke `api.arsip.go.id`. Halaman web hanya bisa mengubah pengaturan yang tervalidasi.

## 7. Kolom indeks CSV

No, Sumber, Kelompok, Tahun, Tanggal Naskah, Nomor, Hal, Pengirim/Pihak, Kode Klasifikasi, Nama Klasifikasi, Asal Klasifikasi, Status, File di SRIKANDI, Lokasi Lokal, Hasil (BERHASIL / SUDAH ADA / DUPLIKAT / DILEWATI / TIDAK ADA FILE / GAGAL), Catatan.
