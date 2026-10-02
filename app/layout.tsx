import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DemoBar } from "@/components/DemoBar";

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

export const metadata: Metadata = {
  title: { default: "Creamy Castle", template: "%s · Creamy Castle" },
  description: "Creamy Castle — play, shop and earn rewards at the venue. Your spend, games and rewards follow your phone number.",
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
      <body>{children}{process.env.NEXT_PUBLIC_DEMO === "1" && <DemoBar />}</body>
    </html>
  );
}
