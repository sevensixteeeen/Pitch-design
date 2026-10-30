// The one place that picks the data layer; no screen imports fake.ts or
// http.ts directly. With the Supabase settings in .env.local the app uses the
// real backend; without them it falls back to this browser's fake data.
import { fake } from "./fake";
import { http } from "./http";
import { supabaseConfigured } from "../lib/supabase";
import type { DataLayer } from "./api";

export const usingFakeData = !supabaseConfigured;
const layer: DataLayer = usingFakeData ? fake : http;

/** Tells open design lists that a thumbnail landed. Leaving the editor uploads the last picture while
 *  Home is already loading, and on a slow connection the list arrives first (BUG-021). */
export const thumbnailUploads = new EventTarget();

export const api: DataLayer = {
  ...layer,
  async uploadThumbnail(id, png) {
    await layer.uploadThumbnail(id, png);
    thumbnailUploads.dispatchEvent(new CustomEvent("uploaded", { detail: id }));
  },
};
export * from "./api";
