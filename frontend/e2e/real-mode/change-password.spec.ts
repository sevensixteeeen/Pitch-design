// S23 change password with the app's real login code: the current password is checked with Supabase (by
// logging in with it) before the new one is saved, and a wrong one is reported plainly.
import { expect, test } from "@playwright/test";
import { apiUp, session, SUPABASE, USER } from "./fakeSupabase";

const CURRENT = "my-current-password";

test("S23-E2 the current password is checked with Supabase before the new one is saved", async ({ page }) => {
  const saved: string[] = []; // new passwords sent to Supabase
  const unexpected: string[] = [];
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes("/auth/v1/token")) {
      const body = req.postDataJSON() as { password?: string };
      return body.password === CURRENT
        ? route.fulfill({ json: session() })
        : route.fulfill({ status: 400, json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } });
    }
    if (url.includes("/auth/v1/user") && req.method() === "PUT") {
      saved.push((req.postDataJSON() as { password: string }).password);
      return route.fulfill({ json: USER });
    }
    if (url.includes("/auth/v1/user")) return route.fulfill({ json: USER });
    unexpected.push(`${req.method()} ${url}`);
    return route.abort();
  });
  await apiUp(page);

  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill(CURRENT);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("link", { name: "Settings" }).click();

  const form = page.getByRole("region", { name: "Change password" });
  await form.getByLabel("Current password", { exact: true }).fill("a-wrong-guess");
  await form.getByLabel("New password", { exact: true }).fill("brand-new-password");
  await form.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("alert")).toHaveText("Your current password isn't right.");
  expect(saved).toEqual([]); // nothing changed

  await form.getByLabel("Current password", { exact: true }).fill(CURRENT);
  await form.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("status")).toContainText("Your password is changed");
  expect(saved).toEqual(["brand-new-password"]);
  expect(unexpected).toEqual([]);
});
