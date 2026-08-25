import Link from "next/link";
import { Gamepad2, ScanLine, ShieldCheck, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const surfaces = [
    {
      href: "/home",
      icon: Gamepad2,
      title: "Player App",
      desc: "Sign in with just your phone number to see the games you've played and redeem rewards.",
      cta: "Open the app",
      accent: "from-[#58cc02] to-[#1cb0f6]",
    },
    {
      href: "/attendant",
      icon: ScanLine,
      title: "Attendant Console",
      desc: "After a guest plays, pull them up by phone and log the game. It appears instantly in their app.",
      cta: "Open attendant",
      accent: "from-[#1cb0f6] to-[#34d399]",
    },
    {
      href: "/admin",
      icon: ShieldCheck,
      title: "Operator Console",
      desc: "Manage games, set milestone rewards, and see players and everything that's been logged.",
      cta: "Open admin",
      accent: "from-[#ffc800] to-[#f97316]",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-14">
      <ThemeToggle floating />
      <header className="mb-14">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Physical arcade · rewards
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          Game <span className="bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] bg-clip-text text-transparent">Pass</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/60">
          Play real games at the venue. The attendant logs each one, and you unlock rewards as you go.
        </p>
        <p className="mt-3 text-sm font-medium text-white/40">
          Play a game → attendant logs it → unlock &amp; redeem rewards.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {surfaces.map((s) => (
          <Link key={s.href} href={s.href} className="card group relative overflow-hidden p-6 transition hover:border-white/20">
            <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-black`}>
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
          <li>• Player: enter any phone number — no password, first time signs you up.</li>
          <li>• Attendant: open the console (no login in the demo) and log a game against that phone.</li>
          <li>• Operator: <code className="text-white/80">admin@arcade.test</code> / <code className="text-white/80">admin1234</code></li>
        </ul>
        <p className="mt-2 text-xs text-white/40">
          It&apos;s all one browser — open the player app and the attendant console in two tabs to see a logged game appear live.
        </p>
      </div>

      <footer className="mt-auto pt-12 text-center text-xs text-white/30">
        Demo · all data stored locally in your browser
      </footer>
    </main>
  );
}
