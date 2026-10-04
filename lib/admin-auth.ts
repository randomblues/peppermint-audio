import { cookies } from "next/headers";
import { createAuthClient, createAdminClient } from "@/lib/supabase";

export async function requireAdmin() {
  const token = (await cookies()).get("supabase-access-token")?.value;
  if (!token) return null;
  const auth = createAuthClient();
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return null;
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const hasAdminRole = user.app_metadata?.role === "admin";
  const isAllowlisted = Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
  if (!hasAdminRole && !isAllowlisted) return null;
  return { user, admin: createAdminClient() };
}
