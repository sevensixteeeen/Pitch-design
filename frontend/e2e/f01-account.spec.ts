// F01 New user signs up (S01 -> S02), plus log in, log out and "Forgot password?".
import { TEST_PASSWORD, expect, expectAccessible, newEmail, signUp, test } from "./fixtures";

test.describe("F01 account", () => {
  test("F01-H1 sign up lands on Home with the sample design; log out; log back in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Test build: accounts are stored only in this browser.")).toBeVisible();
    await expectAccessible(page);

    const email = await signUp(page);
    await expect(page.getByRole("link", { name: /Sample: launch poster/ })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
  });

  test("F01-E1 empty email or password keeps the button disabled", async ({ page }) => {
    await page.goto("/login");
    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("Email").fill("someone@example.test");
    await expect(submit).toBeDisabled();
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await expect(submit).toBeEnabled();
  });

  test("F01-E3 accents in the email and emoji in the password work", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`josé-${Date.now()}@exämple.test`);
    await page.getByLabel("Password", { exact: true }).fill("pässwörd 🎨🎨");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
  });

  test("F01-E6 refresh keeps you logged in, on the same page", async ({ page }) => {
    await signUp(page);
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("F01-E7 a signed-out visitor is sent to log in, then back where they were going", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("F01-E9 the login form fits a 360 px wide phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBe(0);
  });

  test("F01-E10 keyboard only: Tab through the form and press Enter", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").focus();
    await page.keyboard.type(newEmail());
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.keyboard.type(TEST_PASSWORD);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
  });

  test("F01-N1 wrong password is refused with a clear message", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toHaveText("That email and password don't match.");
    await expectAccessible(page);
  });

  test("F01-N2 the same email twice is refused", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toHaveText("There's already an account with that email. Log in instead.");
  });

  test("F01-N3 a 7-character password is refused", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(newEmail());
    await page.getByLabel("Password", { exact: true }).fill("1234567");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toHaveText("Use at least 8 characters for your password.");
  });

  test("F01-H2 forgot password: ask for a link, then set a new password and log in with it", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page.getByRole("status")).toContainText("no email is sent");
    await expectAccessible(page);

    // without a login (an expired or used link) the reset page offers a new link
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "This link doesn't work any more" })).toBeVisible();
    await page.getByRole("button", { name: "Send a new link" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

    // logged in (what the email link does), the page sets a new password
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.goto("/reset-password");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("alert")).toHaveText("Use at least 8 characters for your password.");
    await expectAccessible(page);
    await page.getByLabel("New password", { exact: true }).fill("a-brand-new-password");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("a-brand-new-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
  });
});
