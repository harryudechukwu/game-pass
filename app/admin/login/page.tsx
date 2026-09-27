"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { LoginShell, LoginField } from "@/components/LoginShell";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@arcade.test");
  const [password, setPassword] = useState("admin1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ admin: { role: string } }>("/api/admin/login", { method: "POST", body: { email, password } });
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
      footer={<p className="gp-login-foot">Demo: admin@arcade.test / admin1234</p>}
    >
      <LoginField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <LoginField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </LoginShell>
  );
}
