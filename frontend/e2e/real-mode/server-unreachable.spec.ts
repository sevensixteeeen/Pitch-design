// BUG-010: when Pitch's API server can't be reached, screens said "This link doesn't work any more" (reset
// page) or sent you to log in, as if you weren't logged in. They must say the server can't be reached.
// Runs the app's real data layer against a made-up Supabase address: this file answers every Supabase
// request itself and acts out the API server being down, so nothing leaves the browser.
import { expect, test, type Page } from "@playwright/test";

const SUPABASE = "https://e2e-dummy.supabase.co";
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "reset@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

/** A login token shaped like Supabase's (never checked by anyone: there's no server in these tests). */
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const access_token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: USER.id, email: USER.email, aud: "authenticated", role: "authenticated", exp })}.sig`;
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "e2e-refresh", user: USER };
}

let unexpected: string[] = [];

async function apiServer(page: Page, up: boolean) {
  await page.unroute("**/api/**");
  await page.route("**/api/**", (route) =>
    up && route.request().url().endsWith("/api/me")
      ? route.fulfill({ json: { id: USER.id, email: USER.email, display_name: null } })
      : route.fulfill({ status: 502, body: "" }), // what the dev server answers when the API isn't running
  );
}

test.beforeEach(async ({ page }) => {
  unexpected = [];
  await page.route(`${SUPABASE}/**`, (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/user")) return route.fulfill({ json: USER });
    if (url.includes("/auth/v1/token")) return route.fulfill({ json: session() });
    unexpected.push(url);
    return route.abort();
  });
  await apiServer(page, false);
});

test.afterEach(() => {
  expect(unexpected, "Supabase calls the test didn't expect").toEqual([]);
});

const unreachable = (page: Page) => page.getByRole("heading", { name: "Can't reach Pitch's server" });

test("BUG-010 a password-reset link while the API is off says so, then works once it's back", async ({ page }) => {
  const s = session();
  await page.goto(`/reset-password#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=3600&refresh_token=${s.refresh_token}&token_type=bearer&type=recovery`);
  await expect(unreachable(page)).toBeVisible();
  await expect(page.getByText("This link doesn't work any more")).toHaveCount(0);

  await apiServer(page, true); // the API server was started
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
});

test("BUG-010 logging in while the API is off says the server can't be reached, and so do other screens", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill("any-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("Can't reach Pitch's server");

  // still logged in with Supabase: Home must not send you to log in again
  await page.goto("/");
  await expect(unreachable(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
