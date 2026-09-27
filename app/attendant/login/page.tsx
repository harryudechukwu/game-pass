"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { LoginShell, LoginField } from "@/components/LoginShell";

export default function AttendantLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/attendant/login", { method: "POST", body: { username, password, remember } });
      router.push("/attendant");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <LoginShell
      title="Attendant sign-in"
      subtitle="Log games and items for guests at the front desk"
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Sign in"
      back="/"
      remember={remember}
      onRememberChange={setRemember}
    >
      <LoginField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoFocus required />
      <LoginField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
    </LoginShell>
  );
}
