import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS, type UserRole } from "@/constants/auth";
import {
  LOW_STOCK_ALERT_ROLE_TARGETS,
  type NotificationSeverity,
  type NotificationType,
} from "@/constants/inventory";
import {
  errorLogs,
  notifications,
  products,
  stockBatches,
  suppliers,
  users,
  warehouses,
} from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import { EmailNotifications } from "../email";
import { Jobs } from "../jobs/enqueue";
import type { AuditContext } from "../types";
import {
  getPagination,
  getProductStockStatus,
  parseUuid,
} from "../inventory/shared";

type CreateNotificationInput = {
  actionHref?: string | null;
  message: string;
  roleTarget?: UserRole | null;
  severity: NotificationSeverity;
  title: string;
  type: NotificationType;
  userId?: string | null;
};

function getNotificationSortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "severity") return notifications.severity;
  if (sortBy === "type") return notifications.type;
  if (sortBy === "isRead" || sortBy === "is_read") return notifications.isRead;

  return notifications.createdAt;
}

/**
 * Business logic for in-app notifications.
 */
export class Notifications {
  /**
   * Create one notification.
   */
  static async create(input: CreateNotificationInput) {
    const [notification] = await db
      .insert(notifications)
      .values({
        actionHref: input.actionHref ?? null,
        message: input.message,
        roleTarget: input.roleTarget ?? null,
        severity: input.severity,
        title: input.title,
        type: input.type,
        userId: input.userId ?? null,
      })
      .returning();

    return notification;
  }

  /**
   * Create one notification for a role.
   */
  static createForRole(
    roleTarget: UserRole,
    input: Omit<CreateNotificationInput, "roleTarget" | "userId">,
  ) {
    return this.create({
      ...input,
      roleTarget,
      userId: null,
    });
  }

  /**
   * List notifications visible to one user and role.
   */
  static async list(
    searchParams: Record<string, unknown>,
    viewer: { role: UserRole; userId: string },
  ) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [
      or(
        eq(notifications.userId, viewer.userId),
        eq(notifications.roleTarget, viewer.role),
        and(isNull(notifications.userId), isNull(notifications.roleTarget)),
      )!,
    ];

    if (
      where.severity === "critical" ||
      where.severity === "warning" ||
      where.severity === "info" ||
      where.severity === "success"
    ) {
      conditions.push(eq(notifications.severity, where.severity));
    }

    if (
      where.type === "LOW_STOCK" ||
      where.type === "SYSTEM_ERROR" ||
      where.type === "RESPONSE_TIME_ALERT" ||
      where.type === "UPTIME_ALERT"
    ) {
      conditions.push(eq(notifications.type, where.type));
    }

    if (typeof where.isRead === "string" && where.isRead) {
      conditions.push(eq(notifications.isRead, where.isRead === "true"));
    }

    if (typeof where.is_read === "string" && where.is_read) {
      conditions.push(eq(notifications.isRead, where.is_read === "true"));
    }

    const whereCondition = and(...conditions);
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(notifications)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select()
      .from(notifications)
      .where(whereCondition)
      .orderBy(sortDirection(getNotificationSortColumn(filters.sortBy)))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data,
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Mark one notification as read for a visible notification.
   */
  static async markAsRead(
    id: string,
    viewer: { role: UserRole; userId: string },
  ) {
    const notificationId = parseUuid(id, "ID notifikasi tidak valid.");
    const [notification] = await dbRead
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          or(
            eq(notifications.userId, viewer.userId),
            eq(notifications.roleTarget, viewer.role),
            and(isNull(notifications.userId), isNull(notifications.roleTarget)),
          )!,
        ),
      )
      .limit(1);

    if (!notification) {
      throw new NotFoundAppError("Notifikasi tidak ditemukan.");
    }

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated;
  }

  /**
   * Mark all visible notifications as read.
   */
  static async markAllAsRead(viewer: { role: UserRole; userId: string }) {
    const updated = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        or(
          eq(notifications.userId, viewer.userId),
          eq(notifications.roleTarget, viewer.role),
          and(isNull(notifications.userId), isNull(notifications.roleTarget)),
        ),
      )
      .returning();

    return { count: updated.length };
  }

  /**
   * Create low-stock notification and optional email after stock changes.
   */
  static async createLowStockNotification(
    productId: string,
    warehouseId: string,
    context: AuditContext,
  ) {
    const [row] = await dbRead
      .select({
        currentStock:
          sql<number>`coalesce(sum(${stockBatches.quantityRemaining}), 0)::int`,
        minimumStock: products.minimumStock,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        supplierName: suppliers.name,
        unit: products.unit,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(products)
      .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
      .innerJoin(warehouses, eq(warehouses.id, warehouseId))
      .leftJoin(
        stockBatches,
        and(
          eq(stockBatches.productId, products.id),
          eq(stockBatches.warehouseId, warehouseId),
        ),
      )
      .where(eq(products.id, productId))
      .groupBy(products.id, warehouses.id, suppliers.id)
      .limit(1);

    if (!row) {
      return null;
    }

    const currentStock = Number(row.currentStock ?? 0);
    const stockStatus = getProductStockStatus(currentStock, row.minimumStock);

    if (stockStatus === "available") {
      return null;
    }

    const severity = currentStock <= 0 ? "critical" : "warning";
    const title = currentStock <= 0 ? "Stok produk habis" : "Stok produk rendah";
    const message =
      currentStock <= 0
        ? `Stok ${row.productName} di ${row.warehouseName} sudah habis.`
        : `Stok ${row.productName} di ${row.warehouseName} tersisa ${currentStock} ${row.unit}. Batas minimum ${row.minimumStock} ${row.unit}.`;
    const createdNotifications = [];

    for (const roleTarget of LOW_STOCK_ALERT_ROLE_TARGETS) {
      createdNotifications.push(
        await this.createForRole(roleTarget, {
          actionHref: `/products/${row.productId}`,
          message,
          severity,
          title,
          type: "LOW_STOCK",
        }),
      );
    }

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.LOW_STOCK_NOTIFICATION_CREATED,
        description: `${title} untuk ${row.productSku}.`,
        entityId: row.productId,
        entityType: "product",
        metadata: {
          currentStock,
          minimumStock: row.minimumStock,
          warehouseId: row.warehouseId,
        },
      },
      context,
    );

    const recipients = await dbRead
      .select({
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          or(eq(users.role, "ADMIN"), eq(users.role, "WAREHOUSE_MANAGER"))!,
        ),
      );

    const emailPayload = {
      currentStock,
      minimumStock: row.minimumStock,
      productName: row.productName,
      recipients,
      unit: row.unit,
      warehouseName: row.warehouseName,
    };
    const queuedEmail = await Jobs.enqueueLowStockEmail(emailPayload);

    if (queuedEmail.queued) {
      return createdNotifications;
    }

    try {
      await EmailNotifications.sendLowStockEmail(emailPayload);
    } catch (error) {
      await db.insert(errorLogs).values({
        message:
          error instanceof Error
            ? error.message
            : "Email low-stock gagal dikirim.",
        metadata: {
          productId: row.productId,
          queueReason: queuedEmail.reason ?? null,
          warehouseId: row.warehouseId,
        },
        module: "notification.email",
        severity: "warning",
        stack: error instanceof Error ? error.stack : null,
      });
    }

    return createdNotifications;
  }
}
