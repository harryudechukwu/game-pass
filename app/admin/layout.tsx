"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The login page renders without the authenticated shell.
  if (pathname === "/admin/login") return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
