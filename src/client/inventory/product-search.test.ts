import { describe, expect, it } from "vitest";

import { getProductSearchRank } from "./product-search";

describe("getProductSearchRank", () => {
  const product = {
    categoryName: "Laptop",
    name: "Lenovo ThinkPad T14",
    sku: "NB-LEN-T14",
    supplierName: "PT Nusantara Komputer",
  };

  it("prioritizes exact SKU before partial matches", () => {
    expect(getProductSearchRank(product, "NB-LEN-T14")).toBe(1);
    expect(getProductSearchRank(product, "NB-LEN")).toBe(2);
    expect(getProductSearchRank(product, "thinkpad")).toBe(3);
    expect(getProductSearchRank(product, "komputer")).toBe(4);
  });
});
