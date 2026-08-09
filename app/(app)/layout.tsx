import { CustomerProvider } from "@/components/customer/CustomerProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CustomerProvider>{children}</CustomerProvider>;
}
