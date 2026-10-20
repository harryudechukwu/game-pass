"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { money } from "@/lib/format";
import { ErrorNote, Loading } from "@/components/ui";
import { useAdmin } from "@/components/admin/AdminShell";

type Product = { id: string; name: string; priceKobo: number; active: boolean };
type Item = Product & { costPriceKobo: number | null; stock: number | null };
type Options = { timezone: string; date: string; time: string; games: Product[]; items: Item[] };
type Kind = "game" | "item";

const naira = (kobo: number) => String(kobo / 100);
const validNaira = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(Math.round(Number(value) * 100));

export default function RecordSalePage() {
  const router = useRouter();
  const admin = useAdmin();
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("item");
  const [refId, setRefId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [adjustStock, setAdjustStock] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    api<Options>("/api/admin/sales/options")
      .then((result) => { setOptions(result); setDate(result.date); })
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Could not load sale options."))
      .finally(() => setLoading(false));
  }, []);

  const product = kind === "game" ? options?.games.find((g) => g.id === refId) : options?.items.find((i) => i.id === refId);
  const item = kind === "item" ? product as Item | undefined : undefined;
  const qty = Number(quantity);
  const hasPhone = phone.replace(/\s+/g, "").length > 0;
  const totalKobo = validNaira(unitPrice) && Number.isSafeInteger(qty) ? Math.round(Number(unitPrice) * 100) * qty : 0;
  const canSubmit = admin && ["admin", "manager"].includes(admin.role) && options && product &&
    (!hasPhone || phone.replace(/\s+/g, "").length >= 6) && date && Number.isSafeInteger(qty) && qty >= 1 && qty <= 1000 &&
    validNaira(unitPrice) && Number.isSafeInteger(totalKobo) &&
    (kind === "game" || unitCost === "" || (validNaira(unitCost) && Number.isSafeInteger(Math.round(Number(unitCost) * 100) * qty))) && note.length <= 500;

  function chooseProduct(id: string) {
    setRefId(id);
    const next = kind === "game" ? options?.games.find((g) => g.id === id) : options?.items.find((i) => i.id === id);
    setUnitPrice(next ? naira(next.priceKobo) : "");
    setUnitCost(kind === "item" && next && (next as Item).costPriceKobo != null ? naira((next as Item).costPriceKobo!) : "");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !product || !options) return;
    const message = `Record ${product.name} for ${money(totalKobo)} on ${date}${time ? ` at ${time}` : " (time not recorded)"} (${options.timezone})? This will update revenue${hasPhone ? " and member spend" : ", without crediting a member"}, and the sale will carry a Manual entry tag.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try {
      await api("/api/admin/sales", {
        method: "POST",
        body: {
          phone, name: hasPhone ? name.trim() : "", kind, refId, quantity: qty, amountKobo: totalKobo,
          occurredDate: date, occurredTime: time, note: note.trim(),
          ...(kind === "item" ? { unitCostKobo: unitCost === "" ? null : Math.round(Number(unitCost) * 100), adjustStock } : {}),
        },
      });
      router.push("/admin/sales?source=manual");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not record the sale.");
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="admin-head">
        <Link href="/admin/sales" className="mb-3 inline-flex items-center gap-1 text-sm text-[#0d47a1]"><ArrowLeft size={16} /> Back to sales</Link>
        <h1 className="text-2xl font-black tracking-tight">Record a missed sale</h1>
        <p className="text-sm text-white/50">For a sale that happened but was not logged at the time. Only admins and managers can add one.</p>
      </div>

      {error && <ErrorNote message={error} />}
      {!options ? null : admin && !["admin", "manager"].includes(admin.role) ? (
        <div className="card p-5 text-sm text-white/60">Only an admin or manager can record a missed sale.</div>
      ) : (
        <form onSubmit={submit} className="card space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="missed-phone">Member phone (optional)</label><input id="missed-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Leave blank for a walk-in sale" inputMode="tel" /></div>
            <div><label className="label" htmlFor="missed-name">Member name (if new)</label><input id="missed-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" disabled={!hasPhone} /></div>
          </div>
          <p className="text-xs text-white/50">Without a phone number, the sale counts in revenue but is not added to a member&apos;s spend or rewards.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="missed-date">Date sale happened</label><input id="missed-date" type="date" className="input" max={options.date} value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><label className="label" htmlFor="missed-time">Time sale happened (optional)</label><input id="missed-time" type="time" className="input" max={date === options.date ? options.time : undefined} value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <p className="text-xs text-white/50">Use the venue&apos;s local time ({options.timezone}). Leave time blank if unknown; the sale counts on this date and appears under No time in hourly analytics.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="missed-kind">Sale type</label><select id="missed-kind" className="input" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setRefId(""); setUnitPrice(""); setUnitCost(""); }}><option value="item">Item</option><option value="game">Game</option></select></div>
            <div><label className="label" htmlFor="missed-product">{kind === "item" ? "Item" : "Game"}</label><select id="missed-product" className="input" value={refId} onChange={(e) => chooseProduct(e.target.value)} required><option value="">Choose one</option>{(kind === "item" ? options.items : options.games).map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inactive)"}</option>)}</select></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="missed-quantity">{kind === "game" ? "Hours purchased" : "Quantity sold"}</label><input id="missed-quantity" type="number" min="1" max="1000" step="1" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></div>
            <div><label className="label" htmlFor="missed-price">Unit selling price paid (₦)</label><input id="missed-price" type="number" min="0" step="0.01" className="input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Amount paid per unit" required /></div>
          </div>
          <p className="text-sm font-semibold">Total sale: {money(totalKobo)}</p>
          <p className="text-xs text-white/50">The current catalogue price is filled in for convenience. Change it if the customer paid a different price on that date.</p>

          {kind === "item" && (
            <div className="space-y-3 rounded-xl border border-[#e3f3fd] p-4">
              <div><label className="label" htmlFor="missed-cost">Unit cost at the time (₦)</label><input id="missed-cost" type="number" min="0" step="0.01" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Leave blank if unknown" /></div>
              <p className="text-xs text-white/50">Current catalogue cost is filled in if known. Verify it for this date; clear it if the historical cost is unknown so profit is not overstated.</p>
              {item?.stock != null && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={adjustStock} onChange={(e) => setAdjustStock(e.target.checked)} className="mt-1" /><span>Reduce current tracked stock by {qty || 0} (currently {item.stock}). Turn this off if stock was already reconciled.</span></label>}
            </div>
          )}

          <div><label className="label" htmlFor="missed-note">Reason or reference (optional)</label><textarea id="missed-note" className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Attendant forgot to log the evening sale" /></div>
          <p className="text-xs text-white/50">This entry is tagged Manual entry with your name and the time it was recorded. Games entered here count as completed and do not start a live timer.</p>
          <button type="submit" className="btn-primary w-full" disabled={!canSubmit || busy}>{busy ? "Recording…" : "Record missed sale"}</button>
        </form>
      )}
    </div>
  );
}
