# Analisis Skalabilitas Modul Inventaris dan Alert

Dokumen ini mencatat keputusan teknis yang membuat Modul 3 dan Modul 4 cukup kuat untuk MVP dan tetap mudah diskalakan.

## Database inventory ledger

- Produk adalah master data.
- Stok aktual dihitung dari `stock_batches`.
- Semua perubahan stok dicatat di `stock_movements`.
- Stock in membuat batch baru.
- Stock out mengurangi batch dengan FIFO di dalam database transaction.
- Produk tidak punya field stok utama yang bisa diedit langsung.

## Query list

- Product list memakai pagination, sorting, dan filtering.
- Product list melakukan join kategori dan supplier secara eksplisit.
- Stock summary memakai agregasi `stock_batches`.
- Stock movement list memakai join produk, gudang, dan user.
- Error log list memakai filter severity, module, resolved, dan tanggal.
- Monitoring metrics memakai filter service dan response time.

## Index

- Produk memiliki index untuk SKU, nama, kategori, supplier, status aktif, dan waktu dibuat.
- Batch stok memiliki index untuk produk, gudang, tanggal diterima, dan quantity remaining.
- Movement stok memiliki index untuk produk, gudang, tipe, creator, dan waktu dibuat.
- Notifikasi, error log, dan monitoring memiliki index untuk field yang sering difilter.

## Search produk

- Search memakai SKU exact, SKU prefix, nama produk, kategori, dan supplier.
- Search case-insensitive.
- Search memakai Drizzle query builder agar input user tetap aman.
- Full-text search PostgreSQL bisa ditambahkan nanti jika data produk sudah besar.
- Search engine eksternal belum diperlukan untuk MVP BNSP.

## Alert dan email

- Low-stock alert dibuat setelah stock out jika stok berada di bawah minimum.
- In-app notification menjadi jalur utama.
- Email notification bersifat opsional dan tidak menggagalkan transaksi utama.
- Jika SMTP gagal, sistem mencatat warning di error log.

## Monitoring

- Monitoring menyimpan hasil check API, database, Redis, dan worker di `system_health_checks`.
- Threshold default response time ada di @src/constants/inventory.ts.
- Slow response membuat notification untuk Admin.
- Health check manual tersedia dari UI monitoring.

## Queue readiness

- Low-stock notification, email, error notification, dan monitoring check sudah memakai BullMQ jika `REDIS_URL` tersedia.
- Jika Redis gagal, proses penting fallback ke jalur synchronous agar transaksi stok tetap aman.
- Service sudah dipisah di @src/client/notifications, @src/client/email, @src/client/error-logs, dan @src/client/monitoring.
- Queue runtime dimulai dari API server saat request masuk dan mencatat heartbeat worker ke monitoring.
