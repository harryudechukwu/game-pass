import { redirect } from "next/navigation";

// The root is the player app. Staff reach their consoles at /attendant and /admin.
export default function RootPage() {
  redirect("/home");
}
