# Panduan Troubleshooting Modul Inventaris dan Alert

Gunakan dokumen ini saat demo atau saat fitur Modul 3 dan Modul 4 tidak berjalan sesuai harapan.

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
- Cek recent slow responses.
- Response time di atas 1000 ms membuat warning.
- Response time di atas 3000 ms membuat critical alert.

## Error log muncul

- Buka `Sistem > Error Logs`.
- Filter severity critical lebih dulu.
- Buka detail untuk melihat module, metadata, dan timestamp.
- Admin dapat menandai error sebagai resolved setelah penyebabnya jelas.

## Migration belum jalan

- Jalankan `pnpm db:migrate` setelah database siap.
- Jangan menjalankan migration ke database demo tanpa backup.
- File migration Modul 3 dan Modul 4 ada di @drizzle/0001_pink_golden_guardian.sql.

## Seed data tidak muncul

- Pastikan migration sudah berjalan.
- Jalankan `pnpm db:seed`.
- Seed membuat gudang, kategori, supplier, produk, batch stok, movement, notification, error log, dan monitoring metrics demo.
