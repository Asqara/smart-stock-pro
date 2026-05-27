# Panduan Pengguna SmartStock Pro

Dokumen ini menjelaskan cara memakai fitur Modul 2, Modul 3, Modul 4, dan Modul 5 SmartStock Pro. Halaman utama ada di @src/app/(dashboard).

## Dashboard

- Buka menu `Dashboard`.
- Gunakan rentang tanggal untuk melihat data dashboard. Default adalah 30 hari terakhir.
- Gunakan filter gudang jika ingin melihat data satu gudang saja.
- Kartu ringkasan menampilkan total produk, total gudang, total stok, nilai inventaris, stok rendah, dan transfer pending.
- Area alert hanya menampilkan masalah penting seperti stok habis, stok rendah, error critical, job gagal, dan monitoring bermasalah.
- Chart tren stok membandingkan barang masuk, barang keluar, dan transfer jika datanya tersedia.
- Chart nilai inventaris memakai perhitungan `quantity_remaining * unit_cost`.
- Tekan `Refresh` untuk memuat ulang data tanpa mengganti filter.
- Tekan `Export PDF` jika role memiliki permission export laporan.

## Notification center

- Ikon notifikasi di topbar menampilkan jumlah notifikasi belum dibaca.
- Preview notifikasi diperbarui otomatis dengan polling ringan.
- Buka halaman `Notifikasi` untuk melihat daftar lengkap.
- Gunakan `Tandai dibaca` untuk satu notifikasi.
- Gunakan `Tandai semua dibaca` untuk membersihkan semua notifikasi aktif.
- Notifikasi critical dan warning perlu dicek lebih dulu.

## Galeri produk

- Buka menu `Inventaris > Galeri Produk`.
- Cari produk berdasarkan nama atau SKU.
- Gunakan filter kategori jika tersedia.
- Produk tanpa gambar akan memakai placeholder.
- Pilih gambar JPEG, PNG, atau WebP.
- Batas ukuran gambar adalah 2 MB.
- Preview muncul sebelum gambar diunggah.
- Tekan `Simpan Gambar` untuk mengunggah gambar ke Cloudflare R2.
- Tekan `Hapus gambar` jika gambar lama perlu dilepas.
- Form tambah dan edit produk tidak menyediakan input URL gambar manual.

## Peta gudang

- Buka menu `Inventaris > Peta Gudang`.
- Marker peta menampilkan nama gudang, kota, alamat, total produk, total stok, low stock, dan status.
- Status healthy berarti gudang tidak punya produk low stock.
- Status warning berarti ada produk low stock.
- Status critical berarti ada produk kosong atau masalah besar.
- Jika gudang tidak muncul, cek latitude dan longitude gudang.

## Monitoring resource

- Buka menu `Sistem > Monitoring`.
- Lihat status API, database, Redis, dan worker.
- Lihat CPU usage, memory usage, uptime, dan response time.
- Data monitoring diperbarui otomatis setiap beberapa detik.
- Tekan `Jalankan check` untuk memicu health check manual.
- Response time di atas 1000 ms menjadi warning.
- Response time di atas 3000 ms menjadi critical.

## Export PDF dashboard

- Buka menu `Dashboard`.
- Sesuaikan rentang tanggal dan gudang.
- Tekan `Export PDF`.
- File berisi brand SmartStock Pro, ringkasan KPI, tabel stok rendah, recent movement, dan distribusi stok gudang.
- Nama file memakai format `smartstock-dashboard-YYYY-MM-DD.pdf`.

## Produk

- Buka menu `Inventaris > Produk`.
- Gunakan kolom pencarian untuk mencari SKU atau nama produk.
- Gunakan filter kategori, supplier, dan status stok untuk mempersempit data.
- Tekan `Tambah produk` untuk membuat produk baru.
- Isi SKU, nama, kategori, supplier, unit, harga, dan stok minimum.
- Gunakan menu aksi pada baris produk untuk melihat detail, mengubah, atau menonaktifkan produk.
- Stok produk tidak bisa diedit langsung dari form produk.

## Detail produk

- Buka detail produk dari menu aksi di table produk.
- Lihat total stok, status stok, stok per gudang, batch FIFO, dan riwayat movement.
- Gunakan tombol stock in atau stock out untuk memproses perubahan stok.

## Kategori

- Buka menu `Inventaris > Kategori`.
- Gunakan pencarian untuk mencari nama atau kode kategori.
- Tambahkan kategori dengan nama dan slug yang unik.
- Hapus kategori berarti menonaktifkan data, bukan menghapus fisik dari database.

## Supplier

- Buka menu `Inventaris > Supplier`.
- Cari supplier berdasarkan nama, kontak, email, atau telepon.
- Tambahkan supplier dengan nama wajib.
- Email bersifat opsional, tetapi harus valid jika diisi.

## Gudang

- Buka menu `Inventaris > Gudang`.
- Cari gudang berdasarkan kode, nama, kota, atau alamat.
- Tambahkan gudang dengan kode unik, nama, dan kota.
- Pilih lokasi gudang dari map picker.
- Latitude dan longitude terisi otomatis dari marker peta dan tampil sebagai field readonly.

## Stock in

- Buka menu `Operasional > Stock In`.
- Pilih produk dan gudang.
- Isi jumlah, harga satuan, tanggal diterima, dan catatan jika perlu.
- Submit akan membuat movement `IN` dan batch stok baru.
- Batch baru dipakai oleh algoritma FIFO saat stock out.

## Stock out FIFO

- Buka menu `Operasional > Stock Out`.
- Pilih produk dan gudang.
- Sistem menampilkan stok tersedia setelah produk dan gudang dipilih.
- Isi jumlah keluar.
- Jika jumlah lebih besar dari stok tersedia, sistem menolak sebelum menyimpan.
- Default metode valuasi adalah FIFO.
- Setelah berhasil, batch paling lama berkurang lebih dulu.

## Riwayat stock movement

- Buka menu `Operasional > Stock Movements`.
- Filter berdasarkan produk, gudang, tipe movement, dan tanggal.
- Tipe `IN` menunjukkan stok masuk.
- Tipe `OUT` menunjukkan stok keluar.

## Notifikasi

- Buka menu `Sistem > Notifikasi`.
- Filter notifikasi berdasarkan severity, tipe, dan status baca.
- Gunakan `Tandai semua dibaca` untuk membersihkan notifikasi aktif.
- Notifikasi critical dan warning harus dicek lebih dulu.

## Error log

- Buka menu `Sistem > Error Logs`.
- Filter berdasarkan severity, module, status resolved, dan tanggal.
- Buka detail untuk melihat metadata dan stack jika role memiliki akses.
- Admin dapat menandai error sebagai resolved.

## Monitoring

- Buka menu `Sistem > Monitoring`.
- Lihat status API, database, Redis, dan worker.
- Lihat response time terakhir dan riwayat check terbaru.
- Jalankan check manual jika perlu.
- Response time di atas 1000 ms menjadi warning.
- Response time di atas 3000 ms menjadi critical.

## Dashboard alert

- Dashboard hanya menampilkan alert penting.
- Area alert menampilkan produk low-stock, produk habis, error critical, dan status monitoring bermasalah.

## Modul 5: Transfer, Import, dan Laporan

### Transfer stok

- Buka menu `Operasional > Transfer`.
- Tekan `Buat Transfer` untuk membuat transfer baru.
- Pilih gudang asal dan gudang tujuan. Kedua gudang tidak boleh sama.
- Pilih produk dan isi jumlah yang akan ditransfer.
- Sistem memvalidasi stok tersedia di gudang asal sebelum menyimpan.
- Jika stok tidak cukup, sistem menolak transfer dan menampilkan pesan kesalahan.
- Transfer yang berhasil dibuat akan muncul di list dengan status awal.
- Untuk melihat detail transfer, klik nomor transfer atau gunakan menu aksi.
- Detail transfer menampilkan gudang asal, gudang tujuan, produk, jumlah, status, dan sync logs.
- Untuk membatalkan transfer, buka detail transfer dan tekan `Batalkan Transfer`.
- Transfer yang sudah selesai atau sudah dibatalkan tidak bisa diubah lagi.

### Import data produk

- Buka menu `Operasional > Import`.
- Unduh template Excel dengan menekan `Unduh Template Excel`.
- Isi worksheet `Products Import` sesuai kolom yang tersedia di template.
- Jangan isi gambar produk dari import. Gambar diatur dari menu `Galeri Produk`.
- Tekan `Mulai Import` dan pilih file `.xlsx` yang sudah diisi.
- Sistem akan memvalidasi file dan memulai proses import di background.
- Pantau progres import di list batch import.
- Status batch akan berubah dari `PENDING` ke `PROCESSING` ke `COMPLETED` atau `FAILED`.
- Buka detail batch untuk melihat hasil per baris, termasuk baris yang gagal beserta alasannya.
- Import selesai tidak berarti semua baris berhasil. Periksa kolom jumlah baris gagal.
- Buka tab job di detail batch untuk melihat status job worker yang memproses import.

## Profile dan aktivitas saya

- Buka menu `Profil` dari area user di sidebar.
- User dapat mengubah nama sendiri.
- Email, role, tanggal dibuat, dan login terakhir hanya bisa dilihat.
- Untuk mengubah password, isi password saat ini, password baru, dan konfirmasi password.
- Semua field password punya tombol tampilkan atau sembunyikan.
- Bagian `Aktivitas Saya` menampilkan audit log milik user yang sedang login.
- Non-admin tidak bisa melihat aktivitas user lain.

### Laporan

- Buka menu `Laporan`.
- Tekan `Generate Laporan` untuk membuat laporan baru.
- Pilih tipe laporan, gudang, kategori produk, dan rentang tanggal.
- Pilih format output jika tersedia.
- Tekan `Buat Laporan`. Sistem akan memulai proses di background.
- Status laporan akan berubah dari `PENDING` ke `PROCESSING` ke `COMPLETED` atau `FAILED`.
- Setelah selesai, tekan `Download` di baris laporan untuk mengunduh file.
