// S23 Settings: change your password (the current one is checked first).
import type { Page } from "@playwright/test";
import { TEST_PASSWORD, expect, expectAccessible, newEmail, signUp, test } from "./fixtures";

async function logIn(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("S23 settings", () => {
  test("S23-H1 change the password: the current one is checked; then only the new one logs in", async ({ page }) => {
    const email = newEmail();
    await signUp(page, email);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Account" })).toContainText(email);
    await expectAccessible(page);

    const form = page.getByRole("region", { name: "Change password" });
    const change = async (current: string, next: string) => {
      await form.getByLabel("Current password", { exact: true }).fill(current);
      await form.getByLabel("New password", { exact: true }).fill(next);
      await form.getByRole("button", { name: "Change password" }).click();
    };

    await change("not-my-password", "a-new-password");
    await expect(form.getByRole("alert")).toHaveText("Your current password isn't right.");
    await expectAccessible(page);
    await change(TEST_PASSWORD, TEST_PASSWORD);
    await expect(form.getByRole("alert")).toHaveText("That's your current password. Pick a new one.");
    await change(TEST_PASSWORD, "short");
    await expect(form.getByRole("alert")).toHaveText("Use at least 8 characters for your new password.");

    await change(TEST_PASSWORD, "a-new-password");
    await expect(form.getByRole("status")).toContainText("Your password is changed");
    await expect(form.getByLabel("Current password", { exact: true })).toHaveValue(""); // cleared

    await page.getByRole("button", { name: "Log out" }).click();
    await logIn(page, email, TEST_PASSWORD);
    await expect(page.getByRole("alert")).toHaveText("That email and password don't match.");
    await page.getByLabel("Password", { exact: true }).fill("a-new-password");
    await page.getByRole("button", { name: "Log in" }).click();
    // logged in again: back on the page you left
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });

  test("S23-E1 the settings screen on a 390 px wide phone", async ({ page }) => {
    await signUp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBe(0);
  });
});
