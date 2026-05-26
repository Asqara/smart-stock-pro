import { describe, expect, it } from "vitest";

import { consumeStockLots, getWeightedUnitCost } from "./stock-ledger";

describe("consumeStockLots", () => {
  const lots = [
    {
      id: "batch-older",
      quantityRemaining: 5,
      receivedAt: "2026-01-01T00:00:00.000Z",
      unitCost: 100,
    },
    {
      id: "batch-newer",
      quantityRemaining: 8,
      receivedAt: "2026-02-01T00:00:00.000Z",
      unitCost: 200,
    },
  ];

  it("consumes FIFO from the oldest batch first", () => {
    expect(consumeStockLots(lots, 7, "FIFO")).toEqual([
      {
        consumedQuantity: 5,
        id: "batch-older",
        nextQuantityRemaining: 0,
        unitCost: 100,
      },
      {
        consumedQuantity: 2,
        id: "batch-newer",
        nextQuantityRemaining: 6,
        unitCost: 200,
      },
    ]);
  });

  it("calculates weighted unit cost for consumed stock", () => {
    expect(getWeightedUnitCost(consumeStockLots(lots, 7, "FIFO"))).toBe(129);
  });

  it("rejects insufficient stock", () => {
    expect(() => consumeStockLots(lots, 20, "FIFO")).toThrow(
      "Stok tidak mencukupi.",
    );
  });
});
