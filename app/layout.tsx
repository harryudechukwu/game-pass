import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Nunito: a rounded, chunky font that gives the Duolingo feel.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Game Pass — Arcade",
  description: "Your digital wallet and access pass for real-world arcade games.",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Runs before paint so the saved theme is applied with no flash of the wrong one.
const themeInit = `try{var q=new URLSearchParams(location.search).get('theme');var t=(q==='light'||q==='dark')?q:(localStorage.getItem('theme')||'dark');document.documentElement.setAttribute('data-theme',t);if(q)localStorage.setItem('theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
