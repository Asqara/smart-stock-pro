# Panduan Pengguna Modul Inventaris dan Alert

Dokumen ini menjelaskan cara memakai fitur Modul 3 dan Modul 4 SmartStock Pro. Halaman utama ada di @src/app/(dashboard).

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
- Latitude dan longitude dipakai sebagai data lokasi gudang.

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
