# Analisis Skalabilitas SmartStock Pro

Dokumen ini mencatat keputusan teknis yang membuat Modul 2, Modul 3, Modul 4, dan Modul 5 cukup kuat untuk MVP dan tetap mudah diskalakan.

## Dashboard dan monitoring

- Dashboard summary memakai aggregation query di @src/client/dashboard/index.ts.
- Chart stok memakai rentang tanggal agar API tidak mengirim seluruh data movement.
- Nilai inventaris dihitung dari `stock_batches.quantity_remaining * stock_batches.unit_cost`.
- Data recent movement dan recent transfer dibatasi dengan `limit`.
- Monitoring resource memakai auto refresh terbatas agar UI tetap terbaru tanpa membebani API.
- Notification center memakai polling ringan. SSE atau WebSocket bisa ditambahkan nanti jika volume event meningkat.
- Upload gambar produk memakai Cloudflare R2 lewat `aws4fetch`.
- Database menyimpan `image_key` dan `image_url`, sehingga storage object bisa diganti tanpa mengubah form produk.
- PDF dashboard kecil dibuat langsung dari API. Laporan besar tetap lebih cocok diproses lewat job background.
- Metric monitoring disimpan ringan di `system_health_checks`; versi lanjutan bisa dipindah ke observability stack.
- Response time API dicatat dari middleware request nyata ke `api_response_time_logs`.
- Monitoring CPU memakai `/proc/stat` saat tersedia dan fallback ke CPU proses aplikasi jika runtime bukan Linux.
- Monitoring memory memakai `os.totalmem()` dan `os.freemem()` untuk system memory, lalu menampilkan RSS dan heap proses aplikasi.

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
- Response time chart memakai riwayat request API yang dibatasi, bukan semua log mentah.

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

## Modul 5: Analisis Skalabilitas

### Transfer stok

- Transfer stok diproses dalam satu database transaction.
- Pengurangan stok di gudang asal dan penambahan di gudang tujuan atomic. Tidak bisa corrupt sebagian.
- Jika salah satu operasi gagal, seluruh transaction di-rollback.
- Validasi stok tersedia dilakukan sebelum transaction dimulai.

### Queue Redis dan BullMQ

- Import, laporan, dan warehouse sync diproses lewat queue BullMQ.
- Job antri di Redis dan diambil oleh worker secara asinkron.
- API tidak menunggu job selesai. Response dikirim segera setelah job masuk queue.
- Job gagal bisa di-retry dari UI atau API tanpa mengulangi seluruh proses dari awal.

### Horizontal scaling worker

- Worker adalah proses terpisah dari API server.
- Beberapa instance worker bisa berjalan paralel untuk memproses job lebih cepat.
- BullMQ mengelola distribusi job antar worker secara otomatis.
- Skala worker tidak mempengaruhi API server.

### Import Excel chunked dan concurrency-limited

- File Excel `.xlsx` diproses per chunk untuk menghindari memory spike.
- Concurrency import dibatasi 5 baris sekaligus per job.
- Baris gagal dicatat di level baris, tidak menggagalkan seluruh batch.
- Progress import tersedia secara real-time dari API job status.

### Laporan di background

- Laporan besar tidak diproses di request API langsung.
- Generate laporan membuat job di queue dan langsung return ke client.
- Worker memproses laporan di background dan menyimpan hasilnya ke storage.
- Client polling status laporan atau menunggu notifikasi selesai.

### Warehouse sync

- Sync warehouse saat ini simulasi queue berbasis BullMQ.
- Setiap transfer membuat sync job yang mencatat log per gudang.
- Arsitektur ini bisa dikembangkan ke event-driven menggunakan PostgreSQL LISTEN/NOTIFY atau message broker eksternal seperti Kafka jika volume transfer tinggi.
