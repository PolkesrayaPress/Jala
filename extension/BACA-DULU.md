# JALA Arsip v1.5.1: Jaring Arsip Lokal Otomatis

**Alat arsip pribadi untuk pengguna SRIKANDI.** Setiap pengguna memakai akun SRIKANDI-nya sendiri, dan salinan naskah tersimpan di laptopnya sendiri.

Dikembangkan oleh **Deddy Eko Heryanto, S.T.**, JFT Pranata Komputer Ahli Muda, Perpustakaan Poltekkes Kemenkes Palangka Raya.
JALA bukan produk resmi ANRI dan tidak berafiliasi dengan pengelola SRIKANDI.

Ekstensi Chrome untuk:
1. Mengunduh **salinan** PDF naskah dari akun SRIKANDI Anda sendiri, disusun per tahun (opsional per bulan), kelompok, dan klasifikasi.
2. **Memantau naskah baru** secara berkala dan menampilkan notifikasi di desktop.

Ekstensi ini **tidak memakai AI** dan tidak membutuhkan langganan apa pun. Semua aturannya tetap dan berjalan di Chrome Anda.

## Peringatan: jangan pindahkan atau hapus folder JALA

Folder hasil ekstrak yang Anda pilih saat **Load unpacked** adalah aplikasinya sendiri, bukan installer. Chrome menjalankan JALA langsung dari folder itu.
- **Boleh dihapus:** berkas ZIP hasil unduhan, setelah diekstrak.
- **Jangan dipindah, diganti nama, atau dihapus:** folder `jala` hasil ekstrak. Simpan di lokasi tetap pilihan Anda yang tidak akan dibersihkan atau dipindahkan.
- Kalau terlanjur dipindah: klik **Load unpacked** dan pilih folder di lokasi barunya. Mulai v1.4, kartu lama otomatis tergantikan.

## 0. Penting: satu JALA saja di Chrome

Mulai v1.4, JALA Arsip punya **ID tetap** `bgpfanedbfemacdgbgbnhmjmgaaahagp`. Memasang ulang dari folder mana pun akan **menggantikan** JALA v1.4 yang sudah ada, bukan menambah salinan baru.

Versi sebelum 1.4 belum punya ID tetap. Setiap folder dianggap ekstensi berbeda, sehingga bisa ada beberapa JALA sekaligus. Bersihkan sekali saja:
1. Buka `chrome://extensions`.
2. Klik **Remove** pada semua JALA / SRIKANDI Arsip Agent versi lama (versi 1.0 sampai 1.3.x, termasuk kandidat uji 1.3.0 dari ChatGPT).
3. Pasang v1.4 dengan **Load unpacked**, lalu tekan F5 di tab SRIKANDI.

Akibatnya riwayat versi lama tidak terbawa, karena versi lama belum punya tombol Ekspor. Ini aman: PDF yang diunduh ulang **menimpa** berkas bernama sama, jadi tidak muncul salinan ganda. Pemeriksaan pertama pemantauan akan mencatat data awal lagi.

Halaman Opsi menampilkan **"Your file couldn't be accessed"**? Itu berarti JALA terpasang dari folder yang sudah dipindah, dihapus, atau isinya ditimpa versi lain. Hapus entri itu di `chrome://extensions` lalu pasang ulang.

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
| Batas unduhan per sesi | 100, 300, 500, 1000 (bawaan 300) | Satu klik Mulai unduh berhenti setelah jumlah ini. Klik lagi untuk melanjutkan; naskah yang sudah ada dilewati |
| Unduh juga naskah Terbatas | Ya atau tidak (bawaan tidak) | Aktifkan hanya bila tugas Anda memerlukannya. Naskah Rahasia dan ber-OTP tidak pernah diunduh |

**Persetujuan penyimpanan.** Sebelum unduhan pertama, panel menampilkan lima ketentuan: salinan untuk keperluan kerja sendiri, disimpan di perangkat dinas yang terkunci dan sebaiknya terenkripsi, tidak disinkronkan ke cloud pribadi, naskah Rahasia dan ber-OTP tidak diunduh, dan pemakaian mengikuti kebijakan akses instansi. Tanpa persetujuan, JALA tidak mengunduh apa pun (pemantauan tetap bisa memberi notifikasi). Persetujuan dapat dicabut di halaman Opsi.

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

1. Ekstrak ZIP ke folder tetap pilihan Anda.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder tersebut.
3. Matikan "Ask where to save each file" di `chrome://settings/downloads`.
4. Login SRIKANDI, tekan F5, klik tombol **JALA**, lalu klik **buka** pada setiap sumber sampai semuanya berlabel **siap**. Alamat yang dipelajari disimpan, jadi langkah ini cukup sekali.

## 5. Batasan

- Cakupan mengikuti hak akses akun. Role *User* hanya melihat naskah yang ditujukan, ditembuskan, didisposisikan, atau dibuat oleh Anda.
- Naskah ber-OTP, naskah Rahasia, dan (kecuali diizinkan) naskah Terbatas dilewati dan tercatat "DILEWATI" di indeks. Klasifikasi keamanan dibaca dari kolom **Sifat Naskah** SRIKANDI (`sifat_naskah_nama`, terverifikasi pada daftar naskah masuk dan keluar), lalu dari kode R/T pada nomor naskah (pola `.../R/2026`). Penanda OTP dibaca dari `effective_otp_protected` (naskah masuk) dan pengaturan OTP pada sifat naskah (naskah masuk dan keluar).
- Ini salinan cadangan, bukan pemberkasan resmi. Arsip dinamis yang sah tetap berada di Pemberkasan Arsip Aktif SRIKANDI.
- Selama unduhan penuh berjalan, jangan tutup tab SRIKANDI. Pindah tab atau membuka Word boleh, tetapi tab latar belakang bisa lebih lambat. Kalau tab tertutup, antrean berhenti; klik Mulai unduh lagi dan file yang sudah ada akan dilewati.
- Kalau SRIKANDI mengubah alamat API-nya, ekstensi perlu diperbarui.

## 6. Keamanan

- Hanya membaca. Agen tidak memanggil fungsi tanda tangan, verifikasi, disposisi, pemberkasan, atau hapus.
- Sesi login hanya disimpan di memori tab SRIKANDI. Yang disimpan di ekstensi hanyalah pengaturan, alamat daftar (tanpa sesi), dan daftar ID naskah yang sudah dilihat atau diunduh.
- Unduhan hanya diterima dari `s3.arsip.go.id`. Perintah hanya diterima dari halaman `srikandi.arsip.go.id`.
- Riwayat unduhan diatur di halaman **Opsi** (klik kanan ikon JALA Arsip, pilih Opsi). Menghapus riwayat tidak menghapus file di laptop.
- Header sesi hanya dikirim ke `api.arsip.go.id`. Halaman web hanya bisa mengubah pengaturan yang tervalidasi.
- Alamat unduhan sementara dan nama berkas penyimpanan SRIKANDI tidak dicatat di indeks maupun log.

## 7. Kolom indeks CSV

No, Sumber, Kelompok, Tahun, Tanggal Naskah, Nomor, Hal, Pengirim/Pihak, Kode Klasifikasi, Nama Klasifikasi, Asal Klasifikasi, Status, Lokasi Lokal, Hasil (BERHASIL / SUDAH ADA / DUPLIKAT / DILEWATI / DITUNDA / TIDAK ADA FILE / GAGAL), Catatan.

Sejak 1.5.0 indeks tidak lagi memuat nama berkas di penyimpanan SRIKANDI, agar berkas indeks yang terbagi tidak membuka jalan ke berkas aslinya.
