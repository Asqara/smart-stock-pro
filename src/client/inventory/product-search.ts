/**
 * Minimal product search target used by search ranking helpers.
 */
export type ProductSearchTarget = {
  categoryName?: string | null;
  name: string;
  sku: string;
  supplierName?: string | null;
};

/**
 * Rank a product match. Lower number is a stronger match.
 */
export function getProductSearchRank(
  product: ProductSearchTarget,
  keyword: string,
): number {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const sku = product.sku.toLowerCase();
  const name = product.name.toLowerCase();
  const categoryName = product.categoryName?.toLowerCase() ?? "";
  const supplierName = product.supplierName?.toLowerCase() ?? "";

  if (!normalizedKeyword) {
    return 99;
  }

  if (sku === normalizedKeyword) {
    return 1;
  }

  if (sku.startsWith(normalizedKeyword)) {
    return 2;
  }

  if (name.includes(normalizedKeyword)) {
    return 3;
  }

  if (
    categoryName.includes(normalizedKeyword) ||
    supplierName.includes(normalizedKeyword)
  ) {
    return 4;
  }

  return 99;
}
