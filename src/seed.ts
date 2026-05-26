import { hash } from "@node-rs/argon2";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  DEMO_USER_PASSWORD,
  DEMO_USERS,
  PASSWORD_HASH_OPTIONS,
} from "@/constants/auth";
import {
  categories,
  errorLogs,
  notifications,
  products,
  stockBatches,
  stockMovements,
  suppliers,
  systemHealthChecks,
  users,
  warehouses,
} from "@/drizzle-schema";
import { validatePasswordStrength } from "@/utils/passwordPolicy";

const DATABASE_URL = process.env.DATABASE_URL;

const DEMO_CATEGORIES = [
  { name: "Laptop", slug: "laptop" },
  { name: "Smartphone", slug: "smartphone" },
  { name: "Aksesoris", slug: "aksesoris" },
  { name: "Komponen", slug: "komponen" },
  { name: "Perangkat Jaringan", slug: "perangkat-jaringan" },
] as const;

const DEMO_SUPPLIERS = [
  { name: "PT Nusantara Komputer", contactName: "Budi Santoso", phone: "021-555-0101", email: "sales@nusantarakomputer.test", address: "Jakarta" },
  { name: "CV Surya Digital", contactName: "Dewi Lestari", phone: "031-555-0102", email: "order@suryadigital.test", address: "Surabaya" },
  { name: "PT Bandung Komponen", contactName: "Agus Rahman", phone: "022-555-0103", email: "info@bandungkomponen.test", address: "Bandung" },
  { name: "PT Medan Mobile", contactName: "Rina Putri", phone: "061-555-0104", email: "sales@medanmobile.test", address: "Medan" },
  { name: "CV Makassar Network", contactName: "Fajar Yusuf", phone: "0411-555-0105", email: "order@makassarnetwork.test", address: "Makassar" },
] as const;

const DEMO_WAREHOUSES = [
  { code: "JKT", name: "Gudang Jakarta", city: "Jakarta", address: "Jl. Industri No. 1", latitude: -6.2088, longitude: 106.8456 },
  { code: "SBY", name: "Gudang Surabaya", city: "Surabaya", address: "Jl. Pergudangan No. 2", latitude: -7.2575, longitude: 112.7521 },
  { code: "BDG", name: "Gudang Bandung", city: "Bandung", address: "Jl. Logistik No. 3", latitude: -6.9175, longitude: 107.6191 },
  { code: "MDN", name: "Gudang Medan", city: "Medan", address: "Jl. Distribusi No. 4", latitude: 3.5952, longitude: 98.6722 },
  { code: "MKS", name: "Gudang Makassar", city: "Makassar", address: "Jl. Pelabuhan No. 5", latitude: -5.1477, longitude: 119.4327 },
] as const;

const DEMO_PRODUCTS = [
  ["NB-LEN-T14", "Lenovo ThinkPad T14", "Laptop bisnis 14 inci", "laptop", "PT Nusantara Komputer", "unit", 10, 18500000],
  ["NB-ASU-V14", "Asus VivoBook 14", "Laptop kerja harian", "laptop", "PT Nusantara Komputer", "unit", 12, 9400000],
  ["NB-HP-PRO", "HP ProBook 440", "Laptop kantor", "laptop", "CV Surya Digital", "unit", 8, 12500000],
  ["PH-SAM-A55", "Samsung Galaxy A55", "Smartphone Android", "smartphone", "PT Medan Mobile", "unit", 15, 6200000],
  ["PH-XIA-R13", "Xiaomi Redmi Note 13", "Smartphone mid-range", "smartphone", "PT Medan Mobile", "unit", 20, 3100000],
  ["PH-OPP-R11", "Oppo Reno 11", "Smartphone kamera", "smartphone", "PT Medan Mobile", "unit", 10, 5200000],
  ["AC-LOG-MX3", "Logitech MX Master 3S", "Mouse wireless", "aksesoris", "CV Surya Digital", "unit", 18, 1650000],
  ["AC-KEY-K2", "Keychron K2", "Keyboard mekanik", "aksesoris", "CV Surya Digital", "unit", 12, 1450000],
  ["AC-UGR-C65", "UGreen Charger 65W", "Charger USB-C", "aksesoris", "PT Nusantara Komputer", "unit", 25, 380000],
  ["AC-SAM-T7", "Samsung SSD T7 1TB", "SSD eksternal", "aksesoris", "PT Bandung Komponen", "unit", 10, 1800000],
  ["CP-INT-I5", "Intel Core i5 14400", "Processor desktop", "komponen", "PT Bandung Komponen", "unit", 8, 3600000],
  ["CP-AMD-R5", "AMD Ryzen 5 7600", "Processor desktop", "komponen", "PT Bandung Komponen", "unit", 8, 3900000],
  ["MB-ASU-B650", "ASUS TUF B650M", "Motherboard AM5", "komponen", "PT Bandung Komponen", "unit", 6, 3150000],
  ["RM-COR-16", "Corsair Vengeance 16GB", "RAM DDR5", "komponen", "PT Bandung Komponen", "unit", 20, 1200000],
  ["NW-TP-AX55", "TP-Link Archer AX55", "Router WiFi 6", "perangkat-jaringan", "CV Makassar Network", "unit", 10, 1350000],
  ["NW-MIK-HAP", "MikroTik hAP ax3", "Router kantor", "perangkat-jaringan", "CV Makassar Network", "unit", 8, 1750000],
  ["NW-UBQ-U6", "Ubiquiti UniFi U6+", "Access point", "perangkat-jaringan", "CV Makassar Network", "unit", 10, 2200000],
  ["NW-DLK-24G", "D-Link Switch 24 Port", "Switch gigabit", "perangkat-jaringan", "CV Makassar Network", "unit", 5, 2450000],
  ["AC-JBL-510", "JBL Tune 510BT", "Headphone wireless", "aksesoris", "CV Surya Digital", "unit", 15, 720000],
  ["AC-WDC-2TB", "WD Blue 2TB", "Hard disk internal", "komponen", "PT Bandung Komponen", "unit", 12, 980000],
] as const;

/**
 * Local development seed for SmartStock Pro demo data.
 */
class DemoSeed {
  static async run() {
    if (!DATABASE_URL) {
      console.error("DATABASE_URL belum diatur.");
      process.exit(1);
    }

    const validation = validatePasswordStrength(DEMO_USER_PASSWORD);

    if (!validation.isValid) {
      console.error(validation.messages.join(" "));
      process.exit(1);
    }

    const client = postgres(DATABASE_URL, { prepare: false });
    const db = drizzle(client);
    const seededUsers = await this.seedUsers(db);
    const categoryMap = await this.seedCategories(db);
    const supplierMap = await this.seedSuppliers(db);
    const warehouseMap = await this.seedWarehouses(db);
    const productMap = await this.seedProducts(db, categoryMap, supplierMap);

    await this.seedStock(db, productMap, warehouseMap, seededUsers[0]?.id ?? null);
    await this.seedAlerts(db, seededUsers[0]?.id ?? null);
    await client.end();

    console.log("Seed demo SmartStock Pro selesai.");
    console.log(`Demo password local: ${DEMO_USER_PASSWORD}`);
  }

  private static async seedUsers(db: ReturnType<typeof drizzle>) {
    const seededUsers = [];

    for (const demoUser of DEMO_USERS) {
      const passwordHash = await hash(DEMO_USER_PASSWORD, PASSWORD_HASH_OPTIONS);
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, demoUser.email))
        .limit(1);

      if (existingUser) {
        const [updated] = await db
          .update(users)
          .set({
            isActive: true,
            name: demoUser.name,
            passwordHash,
            role: demoUser.role,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        seededUsers.push(updated);
        continue;
      }

      const [created] = await db
        .insert(users)
        .values({
          email: demoUser.email,
          isActive: true,
          name: demoUser.name,
          passwordHash,
          role: demoUser.role,
        })
        .returning();

      seededUsers.push(created);
    }

    return seededUsers;
  }

  private static async seedCategories(db: ReturnType<typeof drizzle>) {
    const categoryMap = new Map<string, string>();

    for (const category of DEMO_CATEGORIES) {
      const [row] = await db
        .insert(categories)
        .values({
          description: `Kategori ${category.name}.`,
          name: category.name,
          slug: category.slug,
        })
        .onConflictDoUpdate({
          set: {
            description: `Kategori ${category.name}.`,
            name: category.name,
            updatedAt: new Date(),
          },
          target: categories.slug,
        })
        .returning();

      categoryMap.set(category.slug, row.id);
    }

    return categoryMap;
  }

  private static async seedSuppliers(db: ReturnType<typeof drizzle>) {
    const supplierMap = new Map<string, string>();

    for (const supplier of DEMO_SUPPLIERS) {
      const [existing] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.name, supplier.name))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(suppliers)
          .set({ ...supplier, isActive: true, updatedAt: new Date() })
          .where(eq(suppliers.id, existing.id))
          .returning();

        supplierMap.set(supplier.name, updated.id);
        continue;
      }

      const [created] = await db
        .insert(suppliers)
        .values({ ...supplier, isActive: true })
        .returning();

      supplierMap.set(supplier.name, created.id);
    }

    return supplierMap;
  }

  private static async seedWarehouses(db: ReturnType<typeof drizzle>) {
    const warehouseMap = new Map<string, string>();

    for (const warehouse of DEMO_WAREHOUSES) {
      const [row] = await db
        .insert(warehouses)
        .values({ ...warehouse, isActive: true })
        .onConflictDoUpdate({
          set: { ...warehouse, isActive: true, updatedAt: new Date() },
          target: warehouses.code,
        })
        .returning();

      warehouseMap.set(warehouse.code, row.id);
    }

    return warehouseMap;
  }

  private static async seedProducts(
    db: ReturnType<typeof drizzle>,
    categoryMap: Map<string, string>,
    supplierMap: Map<string, string>,
  ) {
    const productMap = new Map<string, string>();

    for (const product of DEMO_PRODUCTS) {
      const [sku, name, description, categorySlug, supplierName, unit, minimumStock, price] = product;
      const categoryId = categoryMap.get(categorySlug);
      const supplierId = supplierMap.get(supplierName);

      if (!categoryId || !supplierId) {
        continue;
      }

      const [row] = await db
        .insert(products)
        .values({
          categoryId,
          description,
          isActive: true,
          minimumStock,
          name,
          price,
          sku,
          supplierId,
          unit,
        })
        .onConflictDoUpdate({
          set: {
            categoryId,
            description,
            isActive: true,
            minimumStock,
            name,
            price,
            supplierId,
            unit,
            updatedAt: new Date(),
          },
          target: products.sku,
        })
        .returning();

      productMap.set(sku, row.id);
    }

    return productMap;
  }

  private static async seedStock(
    db: ReturnType<typeof drizzle>,
    productMap: Map<string, string>,
    warehouseMap: Map<string, string>,
    actorUserId: string | null,
  ) {
    const [existingMovement] = await db.select().from(stockMovements).limit(1);

    if (existingMovement) {
      return;
    }

    const warehouseCodes = [...warehouseMap.keys()];
    let index = 0;

    for (const [sku, productId] of productMap) {
      const warehouseId = warehouseMap.get(warehouseCodes[index % warehouseCodes.length]);

      if (!warehouseId) {
        continue;
      }

      const isLowStock = index % 7 === 0;
      const quantity = isLowStock ? 3 : 18 + index;
      const unitCost = DEMO_PRODUCTS.find((product) => product[0] === sku)?.[7] ?? 1000000;
      const [movement] = await db
        .insert(stockMovements)
        .values({
          createdBy: actorUserId,
          notes: "Seed demo stock in.",
          productId,
          quantity,
          referenceType: "STOCK_IN",
          type: "IN",
          unitCost,
          warehouseId,
        })
        .returning();

      await db.insert(stockBatches).values({
        productId,
        quantityInitial: quantity,
        quantityRemaining: quantity,
        receivedAt: new Date(Date.now() - index * 86_400_000),
        sourceMovementId: movement.id,
        unitCost,
        warehouseId,
      });

      if (index % 5 === 0 && quantity > 5) {
        await db.insert(stockMovements).values({
          createdBy: actorUserId,
          notes: "Seed demo stock out FIFO.",
          productId,
          quantity: 4,
          referenceType: "STOCK_OUT",
          type: "OUT",
          unitCost,
          warehouseId,
        });

        await db
          .update(stockBatches)
          .set({ quantityRemaining: quantity - 4, updatedAt: new Date() })
          .where(and(eq(stockBatches.productId, productId), eq(stockBatches.warehouseId, warehouseId)));
      }

      index += 1;
    }
  }

  private static async seedAlerts(
    db: ReturnType<typeof drizzle>,
    actorUserId: string | null,
  ) {
    const [existingNotification] = await db.select().from(notifications).limit(1);

    if (!existingNotification) {
      await db.insert(notifications).values([
        {
          message: "Stok Lenovo ThinkPad T14 di Gudang Jakarta tersisa 3 unit. Batas minimum 10 unit.",
          roleTarget: "ADMIN",
          severity: "warning",
          title: "Stok produk rendah",
          type: "LOW_STOCK",
          userId: actorUserId,
        },
        {
          message: "Response time API melewati threshold 1000 ms pada check terakhir.",
          roleTarget: "ADMIN",
          severity: "warning",
          title: "Response time lambat",
          type: "RESPONSE_TIME_ALERT",
        },
      ]);
    }

    const [existingError] = await db.select().from(errorLogs).limit(1);

    if (!existingError) {
      await db.insert(errorLogs).values([
        {
          message: "Database connection timeout saat monitoring.",
          metadata: { service: "database" },
          module: "monitoring.database",
          severity: "critical",
        },
        {
          message: "Email low-stock gagal dikirim karena SMTP belum dikonfigurasi.",
          metadata: { smtpConfigured: false },
          module: "notification.email",
          severity: "warning",
        },
        {
          message: "Import job selesai dengan catatan validasi.",
          metadata: { rows: 20 },
          module: "import",
          severity: "info",
        },
      ]);
    }

    const [existingHealth] = await db.select().from(systemHealthChecks).limit(1);

    if (!existingHealth) {
      await db.insert(systemHealthChecks).values([
        {
          checkedAt: new Date(),
          metadata: { demo: true },
          responseTimeMs: 120,
          serviceName: "api",
          status: "healthy",
          uptimeSeconds: 3600,
        },
        {
          checkedAt: new Date(),
          metadata: { demo: true },
          responseTimeMs: 85,
          serviceName: "database",
          status: "healthy",
          uptimeSeconds: 3600,
        },
        {
          checkedAt: new Date(),
          metadata: { jobsWaiting: 0 },
          responseTimeMs: 450,
          serviceName: "redis",
          status: "healthy",
          uptimeSeconds: 3600,
        },
        {
          checkedAt: new Date(),
          metadata: { heartbeat: true },
          responseTimeMs: 0,
          serviceName: "worker",
          status: "healthy",
          uptimeSeconds: 3600,
        },
      ]);
    }
  }
}

await DemoSeed.run();
