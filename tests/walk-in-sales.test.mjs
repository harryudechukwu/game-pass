import test from "node:test";
import assert from "node:assert/strict";
import { memberSpendById } from "../lib/server/customer-spend.ts";
import { summarizeItemSales } from "../lib/server/item-profit.ts";

test("walk-in item sales remain in revenue and profit, not member spend", () => {
  const sales = [
    { playerId: null, kind: "item", amountKobo: 50000, costAmountKobo: 30000 },
    { playerId: "member_1", kind: "item", amountKobo: 80000, costAmountKobo: 40000 },
  ];
  const items = summarizeItemSales(sales);
  assert.equal(items.itemRevenueKobo, 130000);
  assert.equal(items.grossProfitKobo, 60000);
  assert.deepEqual([...memberSpendById(sales)], [["member_1", 80000]]);
});
