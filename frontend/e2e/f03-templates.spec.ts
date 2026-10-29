// F03 Start from a template (S02 -> S04 -> S08), and the editor's Templates tab (S12), milestone 3d.
import type { Page } from "@playwright/test";
import { createDesign, designId, elementList, expect, expectAccessible, expectNoSidewaysScroll, saved, signUp, stored, test } from "./fixtures";

async function openTemplates(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Templates" }).click();
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
}

function cards(page: Page) {
  return page.getByRole("region", { name: "Templates" }).getByRole("listitem");
}

test.describe("F03 templates screen", () => {
  test("F03-H1 pick a template: a new design that's a copy of it opens in the editor", async ({ page }) => {
    await signUp(page);
    await openTemplates(page);
    await expect(cards(page)).toHaveCount(12);
    await expectAccessible(page);

    await page.getByRole("button", { name: /^Quote card/ }).click();
    await expect(page).toHaveURL(/\/design\/[^/]+\/edit$/);
    await expect(page.getByRole("button", { name: "Quote card. Rename" })).toBeVisible();
    await expect(elementList(page)).toHaveCount(5);
    await expect(elementList(page).first()).toHaveText("Text: Your name here"); // top layer
    const design = await stored(page, designId(page));
    expect([design?.width_px, design?.height_px]).toEqual([1080, 1080]);
    // a copy: the template's ids aren't reused
    expect(design?.content.pages[0].elements.map((el) => el.id)).not.toContain("quote");

    // listed with the user's designs
    await page.getByRole("button", { name: "Home" }).click();
    await expect(page.getByRole("link", { name: "Open Quote card" })).toBeVisible();
  });

  test("F03-E3 filter by kind and search; no match shows a way back", async ({ page }) => {
    await signUp(page);
    await openTemplates(page);
    await page.getByRole("button", { name: "Presentations", exact: true }).click();
    await expect(page.getByRole("button", { name: "Presentations", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(2);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Search templates").fill("poster");
    await expect(cards(page)).toHaveCount(2); // Workshop poster, Bake sale (a poster)
    await page.getByLabel("Search templates").fill("zebra");
    await expect(page.getByRole("heading", { name: "No templates match" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Show all templates" }).click();
    await expect(cards(page)).toHaveCount(12);
  });

  test("F03-E4 the templates screen on a 390 px wide phone", async ({ page }) => {
    await signUp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openTemplates(page);
    await expect(cards(page)).toHaveCount(12);
    await expectNoSidewaysScroll(page);
  });
});

test.describe("S12 the editor's Templates tab", () => {
  test("F03-E2 an empty page takes the template at once; a page with content asks first", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1920, 1080);
    await page.getByRole("tab", { name: "Templates" }).click();
    await expectAccessible(page);

    // empty page: applied straight away, resized to fit (a square post on a wide slide)
    await page.getByRole("button", { name: /^Use the template Weekend sale/ }).click();
    await expect(elementList(page)).toHaveCount(6);
    await saved(page);
    let content = (await stored(page, designId(page)))!.content;
    expect(content.pages).toHaveLength(1);
    const xs = content.pages[0].elements.map((el) => el.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(420); // centred: (1920 - 1080) / 2 = 420 at the left edge

    // the page has content now: asked first
    await page.getByRole("button", { name: /^Use the template Title slide/ }).click();
    const dialog = page.getByRole("dialog", { name: 'Use "Title slide"?' });
    await expect(dialog).toContainText("Page 1 already has things on it.");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Add as a new page" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await saved(page);
    content = (await stored(page, designId(page)))!.content;
    expect(content.pages.map((p) => p.elements.length)).toEqual([6, 5]);

    // replace, then undo puts the page back
    await page.getByRole("button", { name: /^Use the template Three key points/ }).click();
    await page.getByRole("dialog", { name: 'Use "Three key points"?' }).getByRole("button", { name: "Replace page 2" }).click();
    await expect(elementList(page)).toHaveCount(10);
    await page.keyboard.press("Control+Z");
    await expect(elementList(page)).toHaveCount(5);
  });
});
