// More small fixes found by the user (2026-10-30): text width going negative, a "Nothing here yet" flash
// after clearing a search, and no thumbnail for a design that only has a background colour.
import { createDesign, designId, expect, saved, signUp, stored, test } from "./fixtures";

test.describe("minor fixes 2", () => {
  test("a design with only a background colour gets a thumbnail", async ({ page }) => {
    await signUp(page);
    // like the real server from India: the upload lands after Home has loaded its list
    await page.evaluate(() => sessionStorage.setItem("pitch.fake.thumbnailDelayMs", "1500"));
    await createDesign(page, 1080, 1920);
    const id = designId(page);
    await page.getByRole("button", { name: "Background colour: #FFFFFF" }).click();
    await page.getByRole("button", { name: "Blue #1C7ED6" }).click();
    await saved(page);
    expect((await stored(page, id))!.content.pages[0].background.color).toBe("#1c7ed6");
    await page.getByRole("button", { name: "Home" }).click();
    const card = page.getByRole("link", { name: "Open Untitled design" });
    await expect(card.locator("img")).toBeVisible({ timeout: 10_000 });
  });

  test("a text box never gets narrower than one letter", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await page.getByRole("tab", { name: "Text" }).click();
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Position" }).click();
    const width = page.getByRole("dialog", { name: "Position" }).getByLabel("Width", { exact: true });
    await width.fill("-50");
    await width.press("Enter");
    await saved(page);
    const [text] = (await stored(page, designId(page)))!.content.pages[0].elements as { width: number; font_size: number }[];
    expect(text.width).toBe(Math.ceil(text.font_size));
    await expect(width).toHaveValue(String(Math.ceil(text.font_size)));
  });

  test("clearing a search shows placeholders, never \"Nothing here yet\"", async ({ page }) => {
    await signUp(page);
    await page.getByRole("searchbox", { name: "Search your designs" }).fill("zzz no match");
    await expect(page.getByText('No designs match "zzz no match"')).toBeVisible();
    // watch every change to the page, so even a one-frame flash is caught
    await page.evaluate(() => {
      const w = window as unknown as { sawEmpty: boolean };
      w.sawEmpty = false;
      new MutationObserver(() => {
        if (document.body.textContent?.includes("Nothing here yet")) w.sawEmpty = true;
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await page.getByRole("button", { name: "Clear search" }).filter({ hasText: "Clear search" }).click(); // not the ✕ in the box
    await expect(page.getByRole("link", { name: "Open Sample: launch poster" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { sawEmpty: boolean }).sawEmpty)).toBe(false);
  });
});
