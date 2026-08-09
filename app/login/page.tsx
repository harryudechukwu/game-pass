"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, ErrorNote } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [isRegistered, setIsRegistered] = useState(true);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ isRegistered: boolean; devCode: string | null }>("/api/auth/otp", {
        method: "POST",
        body: { phone },
      });
      setIsRegistered(res.isRegistered);
      setDevCode(res.devCode);
      if (res.devCode) setCode(res.devCode);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ isNew: boolean; signupBonus: number }>("/api/auth/verify", {
        method: "POST",
        body: {
          phone,
          code,
          ...(isRegistered ? {} : { name, dateOfBirth: dob, acceptTerms: terms }),
        },
      });
      if (res.isNew && res.signupBonus > 0) {
        sessionStorage.setItem("welcomeBonus", String(res.signupBonus));
      }
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ThemeToggle floating />
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={16} /> Home
      </Link>

      <div className="mb-8">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black">
          <Gamepad2 size={28} />
        </div>
        <h1 className="text-3xl font-black tracking-tight">
          {step === "phone" ? "Welcome to Game Pass" : isRegistered ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-white/55">
          {step === "phone"
            ? "Enter your phone number to sign in or sign up."
            : `We sent a 6-digit code to ${phone}.`}
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              className="input"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy || phone.length < 6}>
            {busy ? <Spinner /> : "Send code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          {devCode && (
            <div className="rounded-xl border border-[#58cc02]/30 bg-[#58cc02]/10 px-4 py-3 text-sm text-[#c7bcff]">
              Dev mode — your code is <span className="font-bold tracking-widest">{devCode}</span>
            </div>
          )}
          <div>
            <label className="label" htmlFor="code">6-digit code</label>
            <input
              id="code"
              className="input text-center text-2xl tracking-[0.5em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>

          {!isRegistered && (
            <>
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input
                  id="name"
                  className="input"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="dob">Date of birth</label>
                <input
                  id="dob"
                  type="date"
                  className="input"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#58cc02]"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>I accept the terms of use and the venue safety rules.</span>
              </label>
            </>
          )}

          <button
            className="btn-primary w-full"
            disabled={busy || code.length !== 6 || (!isRegistered && (!name || !dob || !terms))}
          >
            {busy ? <Spinner /> : isRegistered ? "Sign in" : "Create account & get 100 points"}
          </button>

          {!isRegistered && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/45">
              <Sparkles size={14} className="text-[#ffc800]" /> New members get a welcome bonus.
            </p>
          )}

          <button
            type="button"
            onClick={() => { setStep("phone"); setError(""); }}
            className="w-full text-center text-sm text-white/50 hover:text-white"
          >
            Use a different number
          </button>
        </form>
      )}
    </main>
  );
}
