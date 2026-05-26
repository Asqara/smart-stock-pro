import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import { products, suppliers } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import type { AuditContext } from "../types";
import { getPagination, parseUuid } from "./shared";

type SupplierCreateInput = {
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  isActive?: boolean;
  name: string;
  phone?: string | null;
};

type SupplierUpdateInput = Partial<SupplierCreateInput>;

function getSupplierSortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "name") return suppliers.name;
  if (sortBy === "email") return suppliers.email;
  if (sortBy === "updatedAt" || sortBy === "updated_at") {
    return suppliers.updatedAt;
  }

  return suppliers.createdAt;
}

/**
 * Business logic for suppliers.
 */
export class Suppliers {
  /**
   * List suppliers with pagination, sorting, and filtering.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(suppliers.name, `%${filters.search}%`),
          ilike(suppliers.email, `%${filters.search}%`),
          ilike(suppliers.phone, `%${filters.search}%`),
        )!,
      );
    }

    if (typeof where.isActive === "string" && where.isActive) {
      conditions.push(eq(suppliers.isActive, where.isActive === "true"));
    }

    if (typeof where.is_active === "string" && where.is_active) {
      conditions.push(eq(suppliers.isActive, where.is_active === "true"));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(suppliers)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select({
        address: suppliers.address,
        contactName: suppliers.contactName,
        createdAt: suppliers.createdAt,
        email: suppliers.email,
        id: suppliers.id,
        isActive: suppliers.isActive,
        name: suppliers.name,
        phone: suppliers.phone,
        productCount: count(products.id),
        updatedAt: suppliers.updatedAt,
      })
      .from(suppliers)
      .leftJoin(products, eq(suppliers.id, products.supplierId))
      .where(whereCondition)
      .groupBy(suppliers.id)
      .orderBy(sortDirection(getSupplierSortColumn(filters.sortBy)))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      data: data.map((row) => ({
        ...row,
        productCount: Number(row.productCount),
      })),
      pagination: getPagination(filters.page, filters.limit, Number(total)),
    };
  }

  /**
   * Get one supplier by id.
   */
  static async getById(id: string) {
    const supplierId = parseUuid(id, "ID supplier tidak valid.");
    const [supplier] = await dbRead
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) {
      throw new NotFoundAppError("Supplier tidak ditemukan.");
    }

    return supplier;
  }

  /**
   * Create a supplier.
   */
  static async create(input: SupplierCreateInput, context: AuditContext) {
    const [supplier] = await db
      .insert(suppliers)
      .values({
        address: input.address ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        isActive: input.isActive ?? true,
        name: input.name,
        phone: input.phone ?? null,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.SUPPLIER_CREATED,
        description: `Supplier ${supplier.name} dibuat.`,
        entityId: supplier.id,
        entityType: "supplier",
        metadata: { email: supplier.email },
      },
      context,
    );

    return supplier;
  }

  /**
   * Update a supplier.
   */
  static async update(
    id: string,
    input: SupplierUpdateInput,
    context: AuditContext,
  ) {
    const supplierId = parseUuid(id, "ID supplier tidak valid.");
    const current = await this.getById(supplierId);
    const [supplier] = await db
      .update(suppliers)
      .set({
        address: "address" in input ? (input.address ?? null) : current.address,
        contactName:
          "contactName" in input
            ? (input.contactName ?? null)
            : current.contactName,
        email: "email" in input ? (input.email ?? null) : current.email,
        isActive: input.isActive ?? current.isActive,
        name: input.name ?? current.name,
        phone: "phone" in input ? (input.phone ?? null) : current.phone,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.SUPPLIER_UPDATED,
        description: `Supplier ${supplier.name} diperbarui.`,
        entityId: supplier.id,
        entityType: "supplier",
        metadata: { email: supplier.email },
      },
      context,
    );

    return supplier;
  }

  /**
   * Deactivate a supplier.
   */
  static async deactivate(id: string, context: AuditContext) {
    const supplierId = parseUuid(id, "ID supplier tidak valid.");
    const current = await this.getById(supplierId);
    const [supplier] = await db
      .update(suppliers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.SUPPLIER_DEACTIVATED,
        description: `Supplier ${current.name} dinonaktifkan.`,
        entityId: supplier.id,
        entityType: "supplier",
        metadata: { email: current.email },
      },
      context,
    );

    return supplier;
  }
}
