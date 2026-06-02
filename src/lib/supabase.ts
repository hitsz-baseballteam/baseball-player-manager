import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return url;
}

function getSupabaseKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return key;
}

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
