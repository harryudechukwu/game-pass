"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { Icon } from "@/components/Icon";

type Purchase = { id: string; kind: "game" | "item"; name: string; amountLabel: string; quantity: number; createdAt: string };
type Resp = { purchases: Purchase[]; total: number; page: number; pages: number };

export default function PurchasesPage() {
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number) => {
    setData(await api<Resp>(`/api/purchases?page=${p}`));
  }, []);

  useEffect(() => { load(page).catch(() => {}); }, [load, page]);

  const purchases = data?.purchases ?? [];
  const pages = data?.pages ?? 1;

  return (
    <>
      <header className="gp-head">
        <button className="gp-back" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="gp-hi">Purchase History</div>
        <div className="gp-welcome-sub">Every game you&apos;ve played and item you&apos;ve bought{data ? ` · ${data.total} in total` : ""}.</div>
      </header>

      <div className="gp-sheet">
        {purchases.map((p) => (
          <div key={p.id} className="gp-item">
            <div className="gp-tile"><img src={p.kind === "game" ? "/img/game.svg" : "/img/activity.svg"} alt="" /></div>
            <div className="gp-item-main">
              <div className="gp-item-name">{p.name}{p.kind === "item" && p.quantity > 1 ? ` ×${p.quantity}` : ""}</div>
              <div className="gp-item-sub">{timeAgo(p.createdAt)}</div>
            </div>
            <span className="gp-item-amt">{p.amountLabel}</span>
          </div>
        ))}

        {data && purchases.length === 0 && (
          <div className="gp-card"><span className="gp-empty-ic"><Icon name="bag" size={26} /></span><span>Nothing yet. Games you finish and items you buy show up here.</span></div>
        )}

        {pages > 1 && (
          <div className="gp-pager">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous"><ChevronLeft size={18} /></button>
            <span>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} aria-label="Next"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    </>
  );
}
