"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanLine, ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, ErrorNote } from "@/components/ui";

export default function AttendantLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/attendant/login", { method: "POST", body: { username, password } });
      router.push("/attendant");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={16} /> Home
      </Link>
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black">
        <ScanLine size={28} />
      </div>
      <h1 className="text-2xl font-black">Attendant sign-in</h1>
      <p className="mt-1 mb-6 text-white/55">Log games and items for guests.</p>

      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoFocus required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : "Sign in"}</button>
      </form>
    </main>
  );
}
