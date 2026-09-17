import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Capriola: a rounded, friendly display sans — the app's typeface. Single weight
// (400); heavier text is synthesized. Self-hosted so there's no build-time fetch.
const capriola = localFont({
  src: [{ path: "./fonts/capriola-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Game Pass — Arcade",
  description: "Your digital wallet and access pass for real-world arcade games.",
};

export const viewport: Viewport = {
  themeColor: "#2f6bff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={capriola.variable} data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
