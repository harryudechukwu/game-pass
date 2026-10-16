// Cost belongs to the sale, not to the current catalog entry. A null cost means
// the item had no known cost at checkout; it must not be treated as zero cost.
export function snapshotItemCost(costPriceKobo: number | null | undefined, quantity: number) {
  const unitCostKobo = costPriceKobo ?? null;
  return {
    unitCostKobo,
    costAmountKobo: unitCostKobo == null ? null : unitCostKobo * quantity,
  };
}

export function knownItemCost(purchase: { kind: "game" | "item"; costAmountKobo?: number | null; voidedAt?: number | null }): number | null {
  const cost = purchase.costAmountKobo;
  return purchase.kind === "item" && purchase.voidedAt == null && cost != null && Number.isSafeInteger(cost) && cost >= 0 ? cost : null;
}

export function summarizeItemSales(sales: Iterable<{ kind: "game" | "item"; amountKobo: number; costAmountKobo?: number | null; voidedAt?: number | null }>) {
  let itemRevenueKobo = 0;
  let coveredRevenueKobo = 0;
  let costKobo = 0;
  let itemLines = 0;
  let costedItemLines = 0;
  for (const sale of sales) {
    if (sale.kind !== "item" || sale.voidedAt != null) continue;
    itemLines += 1;
    itemRevenueKobo += sale.amountKobo;
    const cost = knownItemCost(sale);
    if (cost == null) continue;
    costedItemLines += 1;
    coveredRevenueKobo += sale.amountKobo;
    costKobo += cost;
  }
  return { itemRevenueKobo, coveredRevenueKobo, costKobo, grossProfitKobo: coveredRevenueKobo - costKobo, itemLines, costedItemLines };
}
