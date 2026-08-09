import { handle, ok } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  return handle(async () => {
    const packages = await prisma.pointPackage.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return ok({
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.points,
        bonusPoints: p.bonusPoints,
        totalPoints: p.points + p.bonusPoints,
        priceKobo: p.priceKobo,
        currency: p.currency,
        priceLabel: formatMoney(p.priceKobo, p.currency),
      })),
    });
  });
}

function formatMoney(kobo: number, currency: string): string {
  const major = kobo / 100;
  const symbol = currency === "NGN" ? "₦" : "";
  return `${symbol}${major.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
