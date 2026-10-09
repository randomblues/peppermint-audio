import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConnection } from "./supabase-config";

export function createAdminClient(): SupabaseClient {
  const { url, key } = supabaseConnection("admin");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function createAuthClient() {
  const { url, key } = supabaseConnection("auth");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const PHOTO_ID_BUCKET = "booking-photo-ids";
