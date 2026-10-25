import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ScrollReveal } from "@/components/ScrollReveal";
import { siteOrigin } from "@/lib/site";

// Outfit: a clean geometric sans — the app's typeface. Self-hosted (400–700) so
// there's no build-time fetch.
const outfit = localFont({
  src: [
    { path: "./fonts/outfit-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/outfit-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/outfit-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/outfit-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/outfit-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

const origin = siteOrigin();

export const metadata: Metadata = {
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  title: { default: "Creamy Castle", template: "%s · Creamy Castle" },
  description: "Discover games, treats and rewards for kids and teens at Creamy Castle. See the venue, plan your visit and get directions.",
  applicationName: "Creamy Castle",
};

export const viewport: Viewport = {
  themeColor: "#0d47a1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable} data-theme="light" suppressHydrationWarning>
      <body>{children}<ScrollReveal /></body>
    </html>
  );
}
