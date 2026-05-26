# Dokumentasi API Modul Inventaris dan Alert

Dokumen ini menjelaskan endpoint Modul 3 dan Modul 4 SmartStock Pro. Implementasi utama ada di @src/api/v1, @src/api/notifications.ts, @src/api/error-logs.ts, @src/api/monitoring.ts, dan business logic ada di @src/client.

## Aturan umum

- Semua endpoint membutuhkan session aktif.
- Hak akses divalidasi di backend melalui permission Modul 3 dan Modul 4.
- Query list mendukung `page`, `limit`, `search`, `sortBy`, `sort_by`, `sortDir`, dan `sort_order`.
- Body request memakai camelCase sesuai pola Eden dan Zod project.
- Stock tidak diedit langsung di produk. Perubahan stok hanya lewat stock in dan stock out.

## Produk

- `GET /api/v1/products`
  - Query: `search`, `categoryId`, `category_id`, `supplierId`, `supplier_id`, `warehouseId`, `warehouse_id`, `stockStatus`, `stock_status`, `isActive`.
  - Sorting: `sku`, `name`, `price`, `minimumStock`, `minimum_stock`, `updatedAt`, `updated_at`, `stock`, `total_stock`.
- `GET /api/v1/products/search`
  - Query sama dengan list produk.
  - Prioritas pencarian: SKU exact, SKU prefix, nama produk, kategori, supplier.
- `GET /api/v1/products/:id`
- `GET /api/v1/products/:id/stock`
- `POST /api/v1/products`
  - Body: `sku`, `name`, `description`, `categoryId`, `supplierId`, `imageUrl`, `unit`, `minimumStock`, `price`, `isActive`.
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
- `POST /api/v1/warehouses`
  - Body: `code`, `name`, `city`, `address`, `latitude`, `longitude`, `isActive`.
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
- `GET /api/monitoring/uptime`
- `GET /api/monitoring/response-time`
- `POST /api/monitoring/check`
  - Body: `serviceName`.

## SQL aman

- Query memakai Drizzle query builder dan parameter binding.
- Product list melakukan join ke kategori dan supplier.
- Stock summary dihitung dari `stock_batches`.
- Stock movement list melakukan join ke produk, gudang, dan user.
- Low-stock query memakai `currentStock <= minimumStock`.
- Error log dan monitoring memakai filter eksplisit.
