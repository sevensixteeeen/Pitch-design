// The browser's Supabase client: used only for logging in and for uploading
// files with a one-off token the API hands out. All data goes through /api.
// The publishable key is meant to be public; the database refuses it anyway
// (row level security on, no policies, no table rights).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True once .env.local has the Supabase settings; until then the app runs on fake data. */
export const supabaseConfigured = Boolean(url && key);

/**
 * A password-reset email link comes back as `#access_token=…&type=recovery`. If Supabase sent it to the
 * Site URL instead of /reset-password (the address isn't on its redirect list), move it there, keeping the
 * `#…` part. Must run before the router starts and before the client below reads and clears the `#…`.
 */
export function routeResetLink() {
  const { pathname, hash } = window.location;
  if (pathname !== "/reset-password" && new URLSearchParams(hash.slice(1)).get("type") === "recovery") {
    window.history.replaceState(null, "", `/reset-password${hash}`);
  }
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing from .env.local.");
  client ??= createClient(url, key);
  return client;
}
