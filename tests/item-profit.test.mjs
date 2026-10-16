import test from "node:test";
import assert from "node:assert/strict";
import { knownItemCost, snapshotItemCost, summarizeItemSales } from "../lib/server/item-profit.ts";
import { money } from "../lib/format.ts";

test("sale cost is a snapshot of the catalog cost", () => {
  const sale = snapshotItemCost(7000, 2);
  assert.deepEqual(sale, { unitCostKobo: 7000, costAmountKobo: 14000 });
  assert.deepEqual(snapshotItemCost(sale.unitCostKobo, 3), { unitCostKobo: 7000, costAmountKobo: 21000 });
  assert.deepEqual(snapshotItemCost(9000, 3), { unitCostKobo: 9000, costAmountKobo: 27000 });
});

test("unknown legacy cost stays unknown while a real zero cost is included", () => {
  assert.deepEqual(snapshotItemCost(null, 2), { unitCostKobo: null, costAmountKobo: null });
  assert.equal(knownItemCost({ kind: "item" }), null);
  assert.equal(knownItemCost({ kind: "item", costAmountKobo: null }), null);
  assert.equal(knownItemCost({ kind: "item", costAmountKobo: 0 }), 0);
});

test("game and voided sales cannot contribute item cost", () => {
  assert.equal(knownItemCost({ kind: "game", costAmountKobo: 14000 }), null);
  assert.equal(knownItemCost({ kind: "item", costAmountKobo: 14000, voidedAt: Date.now() }), null);
  assert.equal(knownItemCost({ kind: "item", costAmountKobo: -1 }), null);
});

test("gross profit uses only costed item sales while revenue includes legacy sales", () => {
  assert.deepEqual(summarizeItemSales([
    { kind: "item", amountKobo: 80000 },
    { kind: "item", amountKobo: 120000, costAmountKobo: 70000 },
    { kind: "item", amountKobo: 50000, costAmountKobo: 0 },
    { kind: "item", amountKobo: 90000, costAmountKobo: 40000, voidedAt: 1 },
    { kind: "game", amountKobo: 300000 },
  ]), {
    itemRevenueKobo: 250000,
    coveredRevenueKobo: 170000,
    costKobo: 70000,
    grossProfitKobo: 100000,
    itemLines: 3,
    costedItemLines: 2,
  });
});

test("money keeps kobo precision and shows a loss with the sign before the currency", () => {
  assert.equal(money(1050), "₦10.50");
  assert.equal(money(-1050), "-₦10.50");
  assert.equal(money(1000), "₦10");
});

test("a sale below cost reports a negative gross profit", () => {
  const figures = summarizeItemSales([{ kind: "item", amountKobo: 8000, costAmountKobo: 12000 }]);
  assert.equal(figures.grossProfitKobo, -4000);
  assert.equal(money(figures.grossProfitKobo), "-₦40");
});
