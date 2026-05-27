# Panduan Troubleshooting SmartStock Pro

Gunakan dokumen ini saat demo atau saat fitur Modul 2, Modul 3, Modul 4, dan Modul 5 tidak berjalan sesuai harapan.

## Dashboard tidak memuat data

- Pastikan session user masih aktif.
- Pastikan role user punya permission `dashboard.read`.
- Cek endpoint `GET /api/v1/dashboard/summary`.
- Cek koneksi database karena summary dihitung dari aggregation query.
- Cek error log jika response gagal tanpa pesan jelas.

## Chart dashboard kosong

- Periksa rentang tanggal yang dipilih.
- Pastikan ada data `stock_movements` pada rentang tanggal tersebut.
- Coba perluas rentang tanggal.
- Jika gudang difilter, pastikan gudang itu punya movement.

## Notifikasi tidak muncul

- Pastikan role user punya permission `notification.read`.
- Cek endpoint `GET /api/notifications/unread-count`.
- Buka halaman notifikasi dan cek filter status baca.
- Jika Redis mati, in-app notification tetap dibaca dari PostgreSQL.

## Upload gambar produk gagal

- Pastikan role user punya permission `product.upload_image`.
- Gunakan file JPEG, PNG, atau WebP.
- Pastikan ukuran file tidak lebih dari 2 MB.
- Jangan memakai SVG karena belum disanitasi.
- Pastikan env Cloudflare R2 lengkap: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, dan `CLOUDFLARE_R2_PUBLIC_URL`.
- Jika `CLOUDFLARE_R2_ENDPOINT` kosong, sistem membuat endpoint dari account id.
- Cek error log module `product-media.r2` jika upload atau delete object gagal.
- Pastikan public URL bucket bisa diakses browser agar gambar tampil di galeri.

## Session stuck atau expired

- Jika halaman berhenti di `Memeriksa session...`, reload halaman.
- Jika token invalid atau expired, aplikasi akan mengarahkan user ke `/login`.
- Cek endpoint `GET /api/v1/auth/me` dan pastikan response invalid session adalah 401.
- Logout harus membersihkan cookie server-side dan cache auth client-side.

## Peta gudang tidak tampil

- Pastikan role user punya permission `warehouse.read_map`.
- Cek endpoint `GET /api/v1/warehouses/map`.
- Pastikan gudang aktif memiliki latitude dan longitude.
- Jika peta tampil kosong, isi koordinat gudang lewat form gudang.

## Export PDF dashboard gagal

- Pastikan role user punya permission `dashboard.export_pdf` atau `report.export_pdf`.
- Cek endpoint `POST /api/v1/dashboard/export-pdf`.
- Kurangi rentang tanggal jika data terlalu banyak.
- Pastikan dashboard memiliki data pada rentang tanggal yang sama dengan filter export.
- Cek error log untuk masalah generator PDF.

## Map picker gudang tidak tampil

- Pastikan package Leaflet dan CSS Leaflet termuat.
- Cek apakah browser memblokir tile OpenStreetMap.
- Jika koordinat belum dipilih, klik peta untuk memasang marker.
- Jika edit gudang, marker akan muncul dari koordinat existing.

## Stok tidak cukup saat stock out

- Cek stok tersedia di halaman detail produk atau stock out.
- Pastikan produk dan gudang yang dipilih benar.
- Cek batch stok di detail produk.
- Buat stock in lebih dulu jika batch tidak ada atau stok habis.

## Produk tidak muncul di pencarian

- Cek apakah produk masih aktif.
- Cari dengan SKU lengkap terlebih dulu.
- Coba keyword nama produk yang lebih pendek.
- Cek filter kategori, supplier, gudang, dan status stok.
- Pastikan data produk sudah tersimpan di database.

## Stock movement gagal

- Pastikan session user masih aktif.
- Pastikan role user punya permission stock in atau stock out.
- Pastikan produk dan gudang masih aktif.
- Pastikan jumlah lebih besar dari 0.
- Untuk stock out, pastikan stok tersedia cukup.

## Email alert tidak terkirim

- Cek env `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM`.
- Email bersifat opsional untuk local development.
- Jika SMTP tidak tersedia, sistem tetap membuat in-app notification.
- Jika SMTP gagal, sistem mencatat warning di error log.

## Redis tidak aktif

- Cek env `REDIS_URL`.
- Cek container Redis di Docker Compose jika dipakai.
- Monitoring akan menandai Redis sebagai degraded atau down.
- Core CRUD dan FIFO tetap memakai PostgreSQL sebagai source of truth.
- Jika Redis aktif, queue alert, email, dan monitoring akan diproses otomatis saat API menerima request.

## Response time tinggi

- Buka `Sistem > Monitoring`.
- Cek service dengan status degraded atau down.
- Cek queue cards untuk melihat job menunggu, diproses, atau gagal.
- Cek recent response log untuk path, method, status, dan durasi request nyata.
- Response time di atas 1000 ms membuat warning.
- Response time di atas 3000 ms membuat critical alert.

## Response time terlihat tidak normal

- Pastikan migration `api_response_time_logs` sudah berjalan.
- Lakukan beberapa request API nyata, misalnya buka halaman produk, dashboard, dan monitoring.
- Monitoring response time tidak hanya membaca endpoint health check ringan.
- Nilai kecil seperti `0,8 ms` masih mungkin untuk endpoint sangat ringan, tetapi tabel log harus menunjukkan request nyata.

## Password gagal diperbarui

- Pastikan password saat ini benar.
- Pastikan password baru mengikuti policy kekuatan password.
- Pastikan konfirmasi password sama dengan password baru.
- Password baru tidak boleh sama dengan password lama.
- Jika tetap gagal, cek audit log dan error log sesuai permission.

## Error log muncul

- Buka `Sistem > Error Logs`.
- Filter severity critical lebih dulu.
- Buka detail untuk melihat module, metadata, dan timestamp.
- Admin dapat menandai error sebagai resolved setelah penyebabnya jelas.

## Migration belum jalan

- Jalankan `pnpm db:migrate` setelah database siap.
- Jangan menjalankan migration ke database demo tanpa backup.
- File migration Modul 3 dan Modul 4 ada di @drizzle/0001_pink_golden_guardian.sql.
- File migration Modul 2 menambahkan resource metric di @drizzle/0003_secret_quentin_quire.sql.

## Seed data tidak muncul

- Pastikan migration sudah berjalan.
- Jalankan `pnpm db:seed`.
- Seed membuat gudang, kategori, supplier, produk, batch stok, movement, notification, error log, dan monitoring metrics demo.

## Modul 5: Troubleshooting

### Transfer gagal karena stok tidak cukup

- Cek stok tersedia di halaman detail produk untuk gudang asal.
- Pastikan jumlah transfer tidak melebihi stok tersedia.
- Gunakan `POST /api/v1/transfers/validate` untuk memvalidasi stok sebelum submit.
- Buat stock in lebih dulu jika stok di gudang asal memang tidak cukup.

### Transfer gagal karena gudang asal dan tujuan sama

- Pilih gudang tujuan yang berbeda dari gudang asal.
- Sistem akan menolak transfer jika kedua gudang bernilai sama.
- Periksa form transfer dan pastikan dropdown gudang asal dan tujuan menunjukkan nilai yang berbeda.

### Import gagal karena kolom tidak sesuai

- Unduh ulang template Excel dari halaman import.
- Pastikan header kolom tidak diubah atau dihapus.
- Pastikan tidak ada kolom tambahan yang tidak dikenali sistem.
- Pastikan worksheet `Products Import` tetap ada.
- Pastikan file yang diunggah berformat `.xlsx`.

### Import selesai dengan sebagian data gagal

- Buka detail batch import.
- Cek tab baris untuk melihat baris mana yang gagal beserta alasannya.
- Perbaiki data di file Excel berdasarkan pesan error per baris.
- Upload ulang file yang sudah diperbaiki.
- Import tidak otomatis rollback baris yang berhasil. Baris yang gagal perlu diimport ulang secara terpisah.

### Laporan gagal dibuat

- Buka list laporan dan cek status laporan.
- Jika status `FAILED`, buka detail laporan untuk melihat pesan error.
- Cek apakah Redis dan worker aktif dari halaman monitoring.
- Jika worker tidak aktif, laporan tidak akan diproses.
- Coba generate ulang laporan setelah worker aktif kembali.

### Redis tidak aktif

- Cek env `REDIS_URL`.
- Cek container Redis di Docker Compose jika dipakai.
- Monitoring akan menandai Redis sebagai degraded atau down.
- Jika Redis mati, job import, laporan, dan transfer sync tidak akan diproses.
- Core CRUD tetap berjalan karena PostgreSQL adalah source of truth.
- Aktifkan kembali Redis dan pastikan worker terhubung sebelum memproses job baru.

### Worker tidak memproses job

- Pastikan proses worker berjalan. Cek dengan `docker compose ps` atau lihat log container worker.
- Pastikan `REDIS_URL` di container worker sama dengan yang dipakai API.
- Cek halaman monitoring untuk status worker.
- Restart container worker jika perlu.

### Job stuck di status PROCESSING

- Job bisa stuck jika worker mati di tengah proses.
- Buka detail job dari halaman monitoring atau list import dan laporan.
- Gunakan `POST /api/v1/jobs/:id/retry` untuk mencoba ulang job yang stuck.
- Pastikan worker sudah berjalan kembali sebelum retry.

### Warehouse sync gagal

- Buka detail transfer dan cek tab sync logs.
- Sync logs mencatat setiap percobaan sinkronisasi stok antar gudang.
- Jika sync gagal, cek pesan error di sync log.
- Pastikan koneksi database stabil saat transfer diproses.
- Jika sync masih gagal, cek error log di `Sistem > Error Logs` untuk detail lebih lanjut.
