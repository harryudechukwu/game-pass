"use client";

import Link from "next/link";

// Only rendered in the demo build. A small floating switcher so a visitor can
// jump straight into each of the three apps (logins are prefilled).
export function DemoBar() {
  const link = { color: "#0d47a1", fontWeight: 700, textDecoration: "none", fontSize: 13 } as const;
  const dot = { color: "#cbd8e8" } as const;
  return (
    <div
      className="no-print"
      style={{
        position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 300,
        display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
        background: "#fff", border: "1px solid #bbdefb", borderBottomWidth: 3, borderRadius: 999, fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: "#5a95f2", letterSpacing: "-0.3px" }}>DEMO</span>
      <Link href="/login" style={link}>Member</Link>
      <span style={dot}>·</span>
      <Link href="/attendant/login" style={link}>Attendant</Link>
      <span style={dot}>·</span>
      <Link href="/admin/login" style={link}>Admin</Link>
    </div>
  );
}
