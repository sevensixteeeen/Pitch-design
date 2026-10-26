// The browser's Supabase client: used only for logging in and for uploading
// files with a one-off token the API hands out. All data goes through /api.
// The publishable key is meant to be public; the database refuses it anyway
// (row level security on, no policies, no table rights).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True once .env.local has the Supabase settings; until then the app runs on fake data. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing from .env.local.");
  client ??= createClient(url, key);
  return client;
}
