import { signOut } from "@/lib/auth";

export async function GET() {
  return signOut({ redirectTo: "/login" });
}
