# Dokumentasi API SmartStock Pro

Dokumen ini menjelaskan endpoint Modul 2, Modul 3, Modul 4, dan Modul 5 SmartStock Pro. Implementasi utama ada di @src/api/v1, @src/api/notifications.ts, @src/api/error-logs.ts, @src/api/monitoring.ts, dan business logic ada di @src/client.

## Aturan umum

- Semua endpoint membutuhkan session aktif.
- Hak akses divalidasi di backend melalui permission Modul 3 dan Modul 4.
- Query list mendukung `page`, `limit`, `search`, `sortBy`, `sort_by`, `sortDir`, dan `sort_order`.
- Body request memakai camelCase sesuai pola Eden dan Zod project.
- Stock tidak diedit langsung di produk. Perubahan stok hanya lewat stock in dan stock out.

## Dashboard Modul 2

- `GET /api/v1/dashboard/summary`
  - Query: `warehouseId`, `warehouse_id`, `categoryId`, `category_id`, `dateFrom`, `date_from`, `dateTo`, `date_to`.
  - Mengembalikan total produk aktif, gudang aktif, total stok, nilai inventaris, stok rendah, transfer pending, error critical, job berjalan, unread notification, dan response time.
- `GET /api/v1/dashboard/stock-trend`
  - Query sama dengan summary.
  - Mengelompokkan movement berdasarkan tanggal dan tipe.
- `GET /api/v1/dashboard/inventory-value`
  - Query sama dengan summary.
  - Menghitung nilai inventaris dari `quantity_remaining * unit_cost`.
- `GET /api/v1/dashboard/stock-by-warehouse`
  - Query sama dengan summary.
  - Mengembalikan total stok, jumlah produk, low stock, dan nilai inventaris per gudang.
- `GET /api/v1/dashboard/low-stock`
  - Query: `warehouseId`, `warehouse_id`, `categoryId`, `category_id`, `limit`.
- `GET /api/v1/dashboard/critical-stock`
  - Query sama dengan low stock.
- `GET /api/v1/dashboard/recent-movements`
  - Query: `warehouseId`, `warehouse_id`, `dateFrom`, `date_from`, `dateTo`, `date_to`, `limit`.
- `GET /api/v1/dashboard/recent-transfers`
  - Query: `warehouseId`, `warehouse_id`, `limit`.
- `GET /api/v1/dashboard/alerts`
  - Query: `limit`.
  - Mengembalikan alert penting dari stok rendah, error unresolved, monitoring degraded, dan job gagal.
- `GET /api/v1/dashboard/export-data`
  - Query sama dengan summary.
- `POST /api/v1/dashboard/export-pdf`
  - Body: `reportType`, `dateFrom`, `dateTo`, `warehouseId`, `categoryId`, `includeCharts`, `includeLowStock`, `includeMovements`.
  - Mengembalikan file PDF dashboard langsung dari API.

## Produk

- `GET /api/v1/products`
  - Query: `search`, `categoryId`, `category_id`, `supplierId`, `supplier_id`, `warehouseId`, `warehouse_id`, `stockStatus`, `stock_status`, `isActive`.
  - Sorting: `sku`, `name`, `price`, `minimumStock`, `minimum_stock`, `updatedAt`, `updated_at`, `stock`, `total_stock`.
- `GET /api/v1/products/search`
  - Query sama dengan list produk.
  - Prioritas pencarian: SKU exact, SKU prefix, nama produk, kategori, supplier.
- `GET /api/v1/products/:id`
- `GET /api/v1/products/:id/stock`
- `GET /api/v1/products/gallery`
  - Query: `page`, `limit`, `search`, `categoryId`, `category_id`.
- `POST /api/v1/products/:id/image`
  - Body: `dataBase64`, `fileName`, `fileSize`, `fileType`.
  - Format yang diterima: JPEG, PNG, dan WebP.
  - Batas ukuran: 2 MB.
- `DELETE /api/v1/products/:id/image`
  - Menghapus object key gambar produk dari Cloudflare R2 dan mengosongkan `imageKey` serta `imageUrl`.
- `POST /api/v1/products`
  - Body: `sku`, `name`, `description`, `categoryId`, `supplierId`, `unit`, `minimumStock`, `price`, `isActive`.
  - URL gambar manual tidak diterima. Gambar hanya diubah lewat endpoint upload gambar produk.
- `PATCH /api/v1/products/:id`
  - Body: sebagian field create product.
- `DELETE /api/v1/products/:id`
  - Aksi ini menonaktifkan produk.

## Kategori

- `GET /api/v1/categories`
  - Query: `page`, `limit`, `search`, `isActive`.
- `GET /api/v1/categories/:id`
- `POST /api/v1/categories`
  - Body: `name`, `slug`, `description`, `isActive`.
- `PATCH /api/v1/categories/:id`
- `DELETE /api/v1/categories/:id`
  - Aksi ini menonaktifkan kategori.

## Supplier

- `GET /api/v1/suppliers`
  - Query: `page`, `limit`, `search`, `isActive`.
- `GET /api/v1/suppliers/:id`
- `POST /api/v1/suppliers`
  - Body: `name`, `contactName`, `phone`, `email`, `address`, `isActive`.
- `PATCH /api/v1/suppliers/:id`
- `DELETE /api/v1/suppliers/:id`
  - Aksi ini menonaktifkan supplier.

## Gudang

- `GET /api/v1/warehouses`
  - Query: `page`, `limit`, `search`, `city`, `isActive`.
- `GET /api/v1/warehouses/:id`
- `GET /api/v1/warehouses/:id/stock`
- `GET /api/v1/warehouses/map`
  - Mengembalikan koordinat gudang dan ringkasan stok untuk Leaflet.
- `GET /api/v1/warehouses/:id/map-summary`
  - Mengembalikan ringkasan stok untuk popup atau halaman detail peta.
- `POST /api/v1/warehouses`
  - Body: `code`, `name`, `city`, `address`, `latitude`, `longitude`, `isActive`.
  - UI gudang memakai map picker untuk mengisi latitude dan longitude.
- `PATCH /api/v1/warehouses/:id`
- `DELETE /api/v1/warehouses/:id`
  - Aksi ini menonaktifkan gudang.

## Stock

- `GET /api/v1/stock/movements`
  - Query: `productId`, `product_id`, `warehouseId`, `warehouse_id`, `type`, `dateFrom`, `date_from`, `dateTo`, `date_to`.
- `GET /api/v1/stock/summary`
- `GET /api/v1/stock/products/:productId`
- `GET /api/v1/stock/warehouses/:warehouseId`
- `POST /api/v1/stock/in`
  - Body: `productId`, `warehouseId`, `quantity`, `unitCost`, `receivedAt`, `notes`.
  - Membuat movement `IN` dan batch stok baru.
- `POST /api/v1/stock/out`
  - Body: `productId`, `warehouseId`, `quantity`, `notes`, `valuationMethod`.
  - Default `valuationMethod` adalah `FIFO`.
  - Mengurangi batch stok di dalam transaction.

## Notifikasi

- `GET /api/notifications`
  - Query: `page`, `limit`, `severity`, `type`, `isRead`, `is_read`.
- `GET /api/notifications/unread-count`
  - Dipakai notification badge dan polling ringan.
- `PATCH /api/notifications/:id/read`
  - Body: `isRead`.
- `PATCH /api/notifications/read-all`
  - Body: `isRead`.

## Error Log

- `GET /api/error-logs`
  - Query: `page`, `limit`, `severity`, `module`, `resolved`, `dateFrom`, `date_from`, `dateTo`, `date_to`.
- `GET /api/error-logs/:id`
- `PATCH /api/error-logs/:id/resolve`
  - Body: `note`.

## Monitoring

- `GET /api/monitoring/health`
- `GET /api/monitoring/metrics`
- `GET /api/monitoring/queues`
- `GET /api/monitoring/resources`
- `GET /api/monitoring/services`
- `GET /api/monitoring/uptime`
- `GET /api/monitoring/response-time`
  - Mengembalikan latest, average, p95, slowest endpoint, dan recent request log dari `api_response_time_logs`.
- `POST /api/monitoring/check`
  - Body: `serviceName`.

## Profile

- `GET /api/v1/profile`
  - Mengembalikan profil user session aktif.
- `PATCH /api/v1/profile`
  - Body: `name`.
  - Email dan role tidak bisa diubah oleh user sendiri.
- `PATCH /api/v1/profile/password`
  - Body: `currentPassword`, `newPassword`, `confirmPassword`.
  - Password lama diverifikasi sebelum hash password baru disimpan.
- `GET /api/v1/profile/activity`
  - Query: `page`, `limit`, `action`, `dateFrom`, `dateTo`.
  - Backend selalu memfilter `audit_logs.user_id` sesuai user session aktif.

## SQL aman

- Query memakai Drizzle query builder dan parameter binding.
- Dashboard summary memakai aggregation query di @src/client/dashboard/index.ts.
- Product list melakukan join ke kategori dan supplier.
- Stock summary dihitung dari `stock_batches`.
- Stock movement list melakukan join ke produk, gudang, dan user.
- Low-stock query memakai `currentStock <= minimumStock`.
- Error log dan monitoring memakai filter eksplisit.
- Response time API dicatat oleh middleware request nyata ke @src/drizzle-schema/index.ts.

## Modul 5 API

### Transfer

- `GET /api/v1/transfers` - list transfer (permission: `transfer.read`)
- `GET /api/v1/transfers/:id` - detail transfer (permission: `transfer.read`)
- `GET /api/v1/transfers/:id/sync-logs` - sync logs untuk transfer (permission: `sync.read`)
- `POST /api/v1/transfers/validate` - validasi stok sebelum transfer (permission: `transfer.validate`)
- `POST /api/v1/transfers` - buat transfer baru (permission: `transfer.create`)
- `POST /api/v1/transfers/:id/cancel` - batalkan transfer (permission: `transfer.cancel`)

### Import

- `GET /api/v1/imports/template` - download template Excel (permission: `import.template_download`)
- `GET /api/v1/imports` - list batch import (permission: `import.read`)
- `GET /api/v1/imports/:id` - detail batch import (permission: `import.read`)
- `GET /api/v1/imports/:id/rows` - hasil per baris dari batch import (permission: `import.read`)
- `GET /api/v1/imports/:id/job` - job terkait batch import (permission: `job.read`)
- `POST /api/v1/imports/upload` - upload file Excel `.xlsx` (permission: `import.create`)

### Laporan

- `GET /api/v1/reports` - list laporan (permission: `report.read`)
- `GET /api/v1/reports/:id` - detail laporan (permission: `report.read`)
- `GET /api/v1/reports/:id/download` - download file laporan (permission: `report.download`)
- `POST /api/v1/reports/generate` - generate laporan baru (permission: `report.generate`)

### Job

- `GET /api/v1/jobs` - list job (permission: `job.read`)
- `GET /api/v1/jobs/:id` - detail job (permission: `job.read`)
- `POST /api/v1/jobs/:id/retry` - retry job yang gagal (permission: `job.retry`)

### Sync

- `GET /api/v1/sync/logs` - list sync log (permission: `sync.read`)
- `GET /api/v1/sync/logs/:id` - detail sync log (permission: `sync.read`)
