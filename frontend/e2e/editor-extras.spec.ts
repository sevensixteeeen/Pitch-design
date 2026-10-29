// Milestone 3c: copy / cut / paste (F05), the right-click menu (S08), download sizes (S20) and the pages
// grid view (F06, S18).
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { createDesign, designId, elementList, expect, expectAccessible, pixel, pngSize, redPng, saved, signUp, stored, test } from "./fixtures";

async function elements(page: Page) {
  await saved(page);
  return (await stored(page, designId(page)))!.content.pages[0].elements;
}

async function addRectangle(page: Page) {
  await page.getByRole("tab", { name: "Elements" }).click();
  await page.getByRole("button", { name: "Add a rectangle" }).click();
}

/** Where an element's centre is on screen (page 1). */
async function centreOf(page: Page, el: { x: number; y: number; width: number; height: number }, design: { width: number }) {
  const box = (await page.getByRole("region", { name: /^Page 1 of \d+$/ }).locator("div[aria-hidden]").first().boundingBox())!;
  const k = box.width / design.width;
  return { x: box.x + (el.x + el.width / 2) * k, y: box.y + (el.y + el.height / 2) * k };
}

async function download(page: Page) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog", { name: "Download" }).getByRole("button", { name: "Download" }).click(),
  ]);
  return readFile(await file.path());
}

test.describe("F05 copy and paste", () => {
  test("F05-E9 Ctrl+C / Ctrl+V pastes a copy 20 px further each time; Ctrl+X cuts", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await addRectangle(page);
    const [first] = await elements(page);

    await page.keyboard.press("Control+C");
    await page.keyboard.press("Control+V");
    await page.keyboard.press("Control+V");
    await expect(elementList(page)).toHaveText(["Rectangle", "Rectangle", "Rectangle"]);
    const els = await elements(page);
    expect(els.map((el) => [el.x - first.x, el.y - first.y])).toEqual([
      [0, 0],
      [20, 20],
      [40, 40],
    ]);
    expect(new Set(els.map((el) => el.id)).size).toBe(3); // new ids, real copies

    await page.keyboard.press("Control+X"); // the last paste is selected
    await expect(elementList(page)).toHaveCount(2);
    await page.keyboard.press("Control+V");
    await expect(elementList(page)).toHaveCount(3);
  });

  test("F05-E10 paste into another design: a photo comes along and shows in its download", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await page.getByRole("tab", { name: "Uploads" }).click();
    await page.getByLabel("Choose images to upload").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page) });
    await page.getByRole("button", { name: "Add red.png to the page" }).click();
    await saved(page);
    await page.keyboard.press("Control+C");

    await page.getByRole("button", { name: "Home" }).click();
    await createDesign(page, 1200, 628);
    await page.keyboard.press("Control+V");
    await expect(elementList(page)).toHaveText(["Image"]);
    const [img] = await elements(page);
    expect([img.x, img.y]).toEqual([450, 214]); // same place as in the first design: nothing to avoid here
    await page.getByRole("button", { name: "Download" }).click();
    expect(await pixel(page, await download(page), 600, 314)).toEqual([255, 0, 0]);
  });
});

test.describe("S08 right-click menu", () => {
  test("S08-E1 right-click an element selects it and offers its actions; empty space offers paste", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await addRectangle(page);
    const [rect] = await elements(page);
    await page.keyboard.press("Escape"); // nothing selected
    await expect(page.getByRole("toolbar", { name: "Page 1" })).toBeVisible();

    const at = await centreOf(page, rect, { width: 1200 });
    await page.mouse.click(at.x, at.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Canvas menu" });
    await expect(menu.getByRole("menuitem", { name: /^Copy/ })).toBeVisible();
    // the open menu hides the rest of the page from screen readers, hence includeHidden
    await expect(page.getByRole("toolbar", { name: "Selected element", includeHidden: true })).toContainText("Rectangle");
    // the menu's own markup; while it's open the menu library hides the rest of the page on purpose
    await expectAccessible(page, '[role="menu"]');
    await menu.getByRole("menuitem", { name: /^Duplicate/ }).click();
    await expect(elementList(page)).toHaveText(["Rectangle", "Rectangle"]);

    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.getByRole("menuitem", { name: /^Lock/ }).click();
    await expect(page.getByRole("toolbar", { name: "Selected element" })).toContainText("Locked");
    await page.mouse.click(at.x, at.y, { button: "right" });
    await expect(page.getByRole("menuitem", { name: /^Delete/ })).toBeDisabled(); // locked
    await page.keyboard.press("Escape");

    // empty space near the page's corner: paste and select all
    const corner = await centreOf(page, { x: 10, y: 10, width: 0, height: 0 }, { width: 1200 });
    await page.mouse.click(corner.x, corner.y, { button: "right" });
    await expect(page.getByRole("menuitem", { name: /^Paste/ })).toBeDisabled(); // nothing copied yet
    await page.getByRole("menuitem", { name: /^Select all/ }).click();
    await expect(page.getByRole("toolbar", { name: "Selected element" })).toContainText("2 selected");
  });
});

test.describe("S20 download sizes", () => {
  test("S20-E1 PNG at 3× is three times the size", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1080, 1080);
    await page.getByRole("button", { name: "Download" }).click();
    const dialog = page.getByRole("dialog", { name: "Download" });
    await dialog.getByRole("combobox", { name: "Size" }).click();
    await expect(page.getByRole("option")).toHaveText(["1× (1080 × 1080 px)", "2× (2160 × 2160 px)", "3× (3240 × 3240 px)"]);
    await page.getByRole("option", { name: /^3×/ }).click();
    await expectAccessible(page);
    expect(pngSize(await download(page))).toEqual({ width: 3240, height: 3240 });
  });

  test("S20-E2 a very large design only offers 1×, and says why", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 8000, 3000);
    await page.getByRole("button", { name: "Download" }).click();
    const dialog = page.getByRole("dialog", { name: "Download" });
    await expect(dialog.getByRole("combobox", { name: "Size" })).toHaveText("1× (8000 × 3000 px)");
    await expect(dialog).toContainText("This design is too large for bigger sizes.");
  });
});

test.describe("F06 pages grid view", () => {
  async function pageIds(page: Page) {
    await saved(page);
    return (await stored(page, designId(page)))!.content.pages.map((p) => p.elements.length);
  }

  test("F06-E4 grid view: pick a page, reorder by keyboard and by dragging, add and delete", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    // page 1 empty, page 2 with a heading, page 3 with two: their element counts tell them apart
    await page.getByRole("button", { name: "Add a page after page 1" }).click();
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Add a page after page 2" }).click();
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Add a subheading" }).click();
    expect(await pageIds(page)).toEqual([0, 1, 2]);

    await page.getByRole("button", { name: "Grid view" }).click();
    const grid = page.getByRole("region", { name: "All pages" });
    await expect(grid.getByRole("button", { name: /^Page \d$/ })).toHaveCount(3);
    await expect(grid.getByRole("button", { name: "Page 3", exact: true })).toBeFocused(); // the page being edited
    await expectAccessible(page);

    await page.keyboard.press("Alt+ArrowLeft"); // page 3 becomes page 2
    expect(await pageIds(page)).toEqual([0, 2, 1]);
    await expect(grid.getByRole("button", { name: "Page 2", exact: true })).toBeFocused();

    const cards = grid.getByRole("listitem");
    const target = (await cards.nth(2).boundingBox())!;
    await cards.nth(0).dragTo(cards.nth(2), { targetPosition: { x: target.width - 5, y: target.height / 2 } });
    expect(await pageIds(page)).toEqual([2, 1, 0]);

    await grid.getByRole("button", { name: "Add a page" }).click();
    await grid.getByRole("button", { name: "Delete page 1" }).click();
    expect(await pageIds(page)).toEqual([1, 0, 0]);

    await grid.getByRole("button", { name: "Page 1", exact: true }).click();
    await expect(grid).toHaveCount(0);
    await expect(page.getByText("Page 1 of 3")).toBeVisible();

    await page.getByRole("button", { name: "Grid view" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "All pages" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Grid view" })).toBeFocused();
  });
});
