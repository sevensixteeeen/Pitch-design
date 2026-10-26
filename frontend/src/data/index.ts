// The one place that picks the data layer; no screen imports fake.ts or
// http.ts directly. With the Supabase settings in .env.local the app uses the
// real backend; without them it falls back to this browser's fake data.
import { fake } from "./fake";
import { http } from "./http";
import { supabaseConfigured } from "../lib/supabase";
import type { DataLayer } from "./api";

export const usingFakeData = !supabaseConfigured;
export const api: DataLayer = usingFakeData ? fake : http;
export * from "./api";
