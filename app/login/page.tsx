"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { phone } });
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="gp-app gp-app--brand">
      <form onSubmit={submit} className="gp-signin">
        <div className="gp-logohex"><Icon name="joystick" size={44} /></div>
        <div>
          <div className="gp-brand">GAME PASS</div>
          <div className="gp-brand-sub">Play · Shop · Win</div>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 11, marginTop: 6 }}>
          {error && <div className="gp-hint" style={{ color: "#ffd9d9", fontWeight: 600 }}>{error}</div>}
          <label htmlFor="phone" className="gp-hint" style={{ textAlign: "left", fontWeight: 700 }}>Your phone number</label>
          <input
            id="phone"
            className="gp-input"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0801 234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
          <button className="gp-cta" disabled={busy || phone.replace(/\s+/g, "").length < 6}>
            {busy ? "Signing in…" : "Start playing"}
          </button>
        </div>

        <div className="gp-hint" style={{ maxWidth: "32ch" }}>
          No password — just your phone. Your spend, games and rewards follow the number.
        </div>
      </form>
    </main>
  );
}
