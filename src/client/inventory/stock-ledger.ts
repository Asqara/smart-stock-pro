import type { StockValuationMethod } from "@/constants/inventory";
import { InsufficientStockError } from "@/lib/errors";

/**
 * Available stock lot used by FIFO and LIFO consumption.
 */
export type StockLot = {
  id: string;
  quantityRemaining: number;
  receivedAt: Date | string;
  unitCost: number;
};

/**
 * Stock lot consumption result.
 */
export type ConsumedStockLot = {
  consumedQuantity: number;
  id: string;
  nextQuantityRemaining: number;
  unitCost: number;
};

/**
 * Consume available stock lots with FIFO or LIFO order.
 */
export function consumeStockLots(
  lots: StockLot[],
  quantity: number,
  valuationMethod: StockValuationMethod = "FIFO",
): ConsumedStockLot[] {
  const availableStock = lots.reduce(
    (total, lot) => total + lot.quantityRemaining,
    0,
  );

  if (quantity <= 0) {
    throw new InsufficientStockError("Jumlah stock out harus lebih dari 0.");
  }

  if (availableStock < quantity) {
    throw new InsufficientStockError(
      `Stok tidak mencukupi. Tersedia ${availableStock}, diminta ${quantity}.`,
    );
  }

  const direction = valuationMethod === "LIFO" ? -1 : 1;
  const sortedLots = [...lots].sort((left, right) => {
    const leftTime = new Date(left.receivedAt).getTime();
    const rightTime = new Date(right.receivedAt).getTime();

    return (leftTime - rightTime) * direction;
  });
  const consumedLots: ConsumedStockLot[] = [];
  let remainingToConsume = quantity;

  for (const lot of sortedLots) {
    if (remainingToConsume <= 0) {
      break;
    }

    const consumedQuantity = Math.min(lot.quantityRemaining, remainingToConsume);
    consumedLots.push({
      consumedQuantity,
      id: lot.id,
      nextQuantityRemaining: lot.quantityRemaining - consumedQuantity,
      unitCost: lot.unitCost,
    });
    remainingToConsume -= consumedQuantity;
  }

  return consumedLots;
}

/**
 * Calculate weighted unit cost for consumed lots.
 */
export function getWeightedUnitCost(consumedLots: ConsumedStockLot[]): number {
  const totalQuantity = consumedLots.reduce(
    (total, lot) => total + lot.consumedQuantity,
    0,
  );

  if (totalQuantity <= 0) {
    return 0;
  }

  const totalCost = consumedLots.reduce(
    (total, lot) => total + lot.consumedQuantity * lot.unitCost,
    0,
  );

  return Math.round(totalCost / totalQuantity);
}
