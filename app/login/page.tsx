"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { LoginShell, LoginField } from "@/components/LoginShell";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState(process.env.NEXT_PUBLIC_DEMO === "1" ? "08031234567" : "");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { phone, remember } });
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <LoginShell
      title="Get started"
      subtitle="Login to your Creamy Castle account and track your rewards"
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Login to account"
      submitDisabled={phone.replace(/\s+/g, "").length < 6}
      remember={remember}
      onRememberChange={setRemember}
    >
      <LoginField
        label="Your phone number"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0801 234 5678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoFocus
      />
    </LoginShell>
  );
}
