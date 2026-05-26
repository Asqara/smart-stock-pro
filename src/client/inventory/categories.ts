import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { AUDIT_ACTIONS } from "@/constants/auth";
import { categories, products } from "@/drizzle-schema";
import { db, dbRead } from "@/lib/db";
import { ConflictAppError, NotFoundAppError } from "@/lib/errors";
import { getFilters } from "@/utils/getFilters";

import { AuditLogs } from "../audit-logs";
import type { AuditContext } from "../types";
import { getPagination, parseUuid } from "./shared";

type CategoryCreateInput = {
  description?: string | null;
  isActive?: boolean;
  name: string;
  slug: string;
};

type CategoryUpdateInput = Partial<CategoryCreateInput>;

function getCategorySortColumn(sortBy?: string): AnyPgColumn {
  if (sortBy === "name") return categories.name;
  if (sortBy === "slug") return categories.slug;
  if (sortBy === "updatedAt" || sortBy === "updated_at") {
    return categories.updatedAt;
  }

  return categories.createdAt;
}

/**
 * Business logic for product categories.
 */
export class Categories {
  /**
   * List categories with pagination, sorting, and filtering.
   */
  static async list(searchParams: Record<string, unknown>) {
    const filters = getFilters(searchParams);
    const where = filters.where;
    const conditions: SQL[] = [];

    if (filters.search) {
      conditions.push(
        or(
          ilike(categories.name, `%${filters.search}%`),
          ilike(categories.slug, `%${filters.search}%`),
        )!,
      );
    }

    if (typeof where.isActive === "string" && where.isActive) {
      conditions.push(eq(categories.isActive, where.isActive === "true"));
    }

    if (typeof where.is_active === "string" && where.is_active) {
      conditions.push(eq(categories.isActive, where.is_active === "true"));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ total }] = await dbRead
      .select({ total: count() })
      .from(categories)
      .where(whereCondition);
    const sortDirection = filters.sortDir === "asc" ? asc : desc;
    const data = await dbRead
      .select({
        createdAt: categories.createdAt,
        description: categories.description,
        id: categories.id,
        isActive: categories.isActive,
        name: categories.name,
        productCount: count(products.id),
        slug: categories.slug,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .leftJoin(products, eq(categories.id, products.categoryId))
      .where(whereCondition)
      .groupBy(categories.id)
      .orderBy(sortDirection(getCategorySortColumn(filters.sortBy)))
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
   * Get one category by id.
   */
  static async getById(id: string) {
    const categoryId = parseUuid(id, "ID kategori tidak valid.");
    const [category] = await dbRead
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new NotFoundAppError("Kategori tidak ditemukan.");
    }

    return category;
  }

  /**
   * Create a category.
   */
  static async create(input: CategoryCreateInput, context: AuditContext) {
    await this.ensureSlugAvailable(input.slug);

    const [category] = await db
      .insert(categories)
      .values({
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        name: input.name,
        slug: input.slug,
      })
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.CATEGORY_CREATED,
        description: `Kategori ${category.name} dibuat.`,
        entityId: category.id,
        entityType: "category",
        metadata: { slug: category.slug },
      },
      context,
    );

    return category;
  }

  /**
   * Update a category.
   */
  static async update(
    id: string,
    input: CategoryUpdateInput,
    context: AuditContext,
  ) {
    const categoryId = parseUuid(id, "ID kategori tidak valid.");
    const current = await this.getById(categoryId);

    if (input.slug && input.slug !== current.slug) {
      await this.ensureSlugAvailable(input.slug, categoryId);
    }

    const [category] = await db
      .update(categories)
      .set({
        description:
          "description" in input ? (input.description ?? null) : current.description,
        isActive: input.isActive ?? current.isActive,
        name: input.name ?? current.name,
        slug: input.slug ?? current.slug,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.CATEGORY_UPDATED,
        description: `Kategori ${category.name} diperbarui.`,
        entityId: category.id,
        entityType: "category",
        metadata: { slug: category.slug },
      },
      context,
    );

    return category;
  }

  /**
   * Deactivate a category.
   */
  static async deactivate(id: string, context: AuditContext) {
    const categoryId = parseUuid(id, "ID kategori tidak valid.");
    const current = await this.getById(categoryId);
    const [category] = await db
      .update(categories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId))
      .returning();

    await AuditLogs.create(
      {
        action: AUDIT_ACTIONS.CATEGORY_DEACTIVATED,
        description: `Kategori ${current.name} dinonaktifkan.`,
        entityId: category.id,
        entityType: "category",
        metadata: { slug: current.slug },
      },
      context,
    );

    return category;
  }

  private static async ensureSlugAvailable(slug: string, exceptCategoryId?: string) {
    const [existing] = await dbRead
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!existing) {
      return;
    }

    if (exceptCategoryId && existing.id === exceptCategoryId) {
      return;
    }

    throw new ConflictAppError("Kode kategori sudah digunakan.");
  }
}
