// Anonymous walk-in sales count in revenue, but have no member account to credit.
export function memberSpendById(sales: readonly { playerId: string | null; amountKobo: number }[]): Map<string, number> {
  const spend = new Map<string, number>();
  for (const sale of sales) {
    if (sale.playerId != null) spend.set(sale.playerId, (spend.get(sale.playerId) ?? 0) + sale.amountKobo);
  }
  return spend;
}
