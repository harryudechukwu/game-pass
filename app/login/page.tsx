"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, ErrorNote } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={16} /> Home
      </Link>

      <div className="mb-8">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black">
          <Gamepad2 size={28} />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Welcome to Game Pass</h1>
        <p className="mt-2 text-white/55">Enter your phone number to see your games and rewards.</p>
      </div>

      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className="input text-lg"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 08012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button className="btn-primary w-full py-4 text-base" disabled={busy || phone.length < 6}>
          {busy ? <Spinner /> : "Continue"}
        </button>
        <p className="text-center text-xs text-white/40">
          No password needed. First time? You&apos;re in as soon as you continue.
        </p>
      </form>
    </main>
  );
}
