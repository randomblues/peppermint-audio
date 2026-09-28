import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

export function createAdminClient(): SupabaseClient {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const PHOTO_ID_BUCKET = "booking-photo-ids";
