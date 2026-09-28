import { cookies } from "next/headers";
import { createAuthClient, createAdminClient } from "@/lib/supabase";

export async function requireAdmin() {
  const token = (await cookies()).get("supabase-access-token")?.value;
  if (!token) return null;
  const auth = createAuthClient();
  const { data: { user }, error } = await auth.auth.getUser(token);
  return error || !user ? null : { user, admin: createAdminClient() };
}
