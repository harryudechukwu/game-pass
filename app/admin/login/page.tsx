"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { LoginShell, LoginField } from "@/components/LoginShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEMO === "1" ? "owner@creamycastle.demo" : "");
  const [password, setPassword] = useState(process.env.NEXT_PUBLIC_DEMO === "1" ? "demo1234" : "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ admin: { role: string } }>("/api/admin/login", { method: "POST", body: { email, password, remember } });
      router.push(res.admin.role === "manager" ? "/admin/overview" : "/admin");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <LoginShell
      title="Operator console"
      subtitle="Sign in to manage Creamy Castle"
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Sign in"
      back="/"
      remember={remember}
      onRememberChange={setRemember}
      footer={process.env.NEXT_PUBLIC_DEMO === "1" ? <p className="gp-login-foot">Demo · admin: owner@creamycastle.demo · manager: manager@creamycastle.demo · password: demo1234</p> : undefined}
    >
      <LoginField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <LoginField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </LoginShell>
  );
}
