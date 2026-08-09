import Link from "next/link";
import { Gamepad2, ScanLine, ShieldCheck, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const surfaces = [
    {
      href: "/home",
      icon: Gamepad2,
      title: "Customer App",
      desc: "Your wallet & access pass. Pick a physical game, pay with points, get a Play Pass.",
      cta: "Open the app",
      accent: "from-[#58cc02] to-[#1cb0f6]",
    },
    {
      href: "/station",
      icon: ScanLine,
      title: "Game Station",
      desc: "The self-service kiosk simulator. Scan a Play Pass, authorize play, run the session.",
      cta: "Open station",
      accent: "from-[#1cb0f6] to-[#34d399]",
    },
    {
      href: "/admin",
      icon: ShieldCheck,
      title: "Operator Console",
      desc: "Manage games, rewards, customers & wallets. Watch live sessions and revenue.",
      cta: "Open admin",
      accent: "from-[#ffc800] to-[#f97316]",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-14">
      <ThemeToggle floating />
      <header className="mb-14">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Self-service physical arcade
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          Game <span className="bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] bg-clip-text text-transparent">Pass</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/60">
          The app is your digital wallet and access pass. The real fun is the physical game on the
          floor.
        </p>
        <p className="mt-3 text-sm font-medium text-white/40">
          Choose activity → Pay with points → Scan → Physical game starts.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {surfaces.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card group relative overflow-hidden p-6 transition hover:border-white/20"
          >
            <div
              className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-black`}
            >
              <s.icon size={24} />
            </div>
            <h2 className="text-lg font-bold">{s.title}</h2>
            <p className="mt-2 text-sm text-white/55">{s.desc}</p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 group-hover:text-white">
              {s.cta} <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 card p-5 text-sm text-white/60">
        <p className="font-semibold text-white/80">Demo access</p>
        <ul className="mt-2 space-y-1">
          <li>• Customer: any phone number — the OTP is shown on screen (dev mode).</li>
          <li>• Operator: <code className="text-white/80">admin@arcade.test</code> / <code className="text-white/80">admin1234</code></li>
          <li>• Station key is pre-loaded into the kiosk simulator.</li>
        </ul>
      </div>

      <footer className="mt-auto pt-12 text-center text-xs text-white/30">
        Backend is the source of truth · single-use Play Passes · transactional wallet ledger
      </footer>
    </main>
  );
}
