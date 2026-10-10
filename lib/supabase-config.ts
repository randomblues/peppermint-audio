export function usesLocalSupabase() {
  const target = process.env.SUPABASE_TARGET;
  if (target && target !== "local" && target !== "hosted") {
    throw new Error("SUPABASE_TARGET must be local or hosted.");
  }
  if (process.env.NODE_ENV === "development" && target === "hosted") {
    throw new Error("Local development cannot connect to hosted Supabase.");
  }
  const local = target === "local" || process.env.NODE_ENV === "development"
    || (!target && !process.env.VERCEL && process.env.NODE_ENV !== "test");
  if (local && process.env.VERCEL) {
    throw new Error("Local Supabase cannot be used in a Vercel deployment.");
  }
  return local;
}

export function supabaseConnection(role: "admin" | "auth") {
  const local = usesLocalSupabase();
  const url = local ? process.env.LOCAL_SUPABASE_URL : process.env.SUPABASE_URL;
  const key = role === "admin"
    ? local ? process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
    : local ? process.env.LOCAL_SUPABASE_ANON_KEY : process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(local
      ? "Local Supabase is not configured. Run npm run dev."
      : role === "admin"
        ? "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        : "Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  if (local) {
    const parsed = new URL(url);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
      || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("Local Supabase must use a loopback URL; hosted connections are blocked.");
    }
  }
  return { url, key };
}
