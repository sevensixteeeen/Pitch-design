// For the real-mode tests: a made-up Supabase project the tests answer for (playwright.config.ts points the
// app at this address), so the app's real login code runs and nothing leaves the browser.
import type { Page } from "@playwright/test";

export const SUPABASE = "https://e2e-dummy.supabase.co";

export const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "reset@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

/** A login token shaped like Supabase's (never checked by anyone: there's no server in these tests). */
export function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const access_token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: USER.id, email: USER.email, aud: "authenticated", role: "authenticated", exp })}.sig`;
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "e2e-refresh", user: USER };
}

/** Pitch's API, answering who's logged in. */
export async function apiUp(page: Page) {
  await page.route("**/api/me", (route) => route.fulfill({ json: { id: USER.id, email: USER.email, display_name: null } }));
}
