// Small fixes found by the user (2026-10-30): new elements stacking, the font size box, the rotate
// handle after a flip, units in the size error, the remembered sort, Make a copy on cards, upload errors.
import type { Page } from "@playwright/test";
import { createDesign, designId, elementList, expect, saved, signUp, stored, test } from "./fixtures";

const SAMPLE = "Sample: launch poster";

async function elements(page: Page) {
  await saved(page);
  return (await stored(page, designId(page)))!.content.pages[0].elements;
}

async function add(page: Page, what: string) {
  await page.getByRole("tab", { name: "Elements" }).click();
  await page.getByRole("button", { name: `Add ${what}` }).click();
}

async function openProjects(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
}

test.describe("minor fixes", () => {
  test("new elements step down and right instead of stacking; new shapes are blue", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await add(page, "a rectangle");
    await add(page, "a rectangle");
    await add(page, "an ellipse");
    await expect(elementList(page)).toHaveCount(3);
    const els = await elements(page);
    const step = Math.round(628 * 0.04);
    expect(els.map((el) => [el.x - els[0].x, el.y - els[0].y])).toEqual([
      [0, 0],
      [step, step],
      [2 * step, 2 * step], // the same size, so it steps past both
    ]);
    expect(els.map((el) => (el as { fill?: string }).fill)).toEqual(["#0297de", "#0297de", "#0297de"]);
  });

  test("the font size box shows the whole number", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 }); // a crowded toolbar
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Text" }).click();
    await page.getByRole("button", { name: "Add a heading" }).click();
    const size = page.getByRole("toolbar", { name: "Selected element" }).getByLabel("Font size");
    for (const value of ["60", "800"]) {
      await size.fill(value);
      await size.press("Enter");
      await expect(size).toHaveValue(value);
      expect(await size.evaluate((input: HTMLInputElement) => input.scrollWidth <= input.clientWidth)).toBe(true);
    }
  });

  test("the rotate handle stays at the top of a rotated element after a flip", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await add(page, "a rectangle");
    await page.getByRole("button", { name: "Position" }).click();
    const panel = page.getByRole("dialog", { name: "Position" });
    await panel.getByLabel("Rotation", { exact: true }).fill("30");
    await panel.getByLabel("Rotation", { exact: true }).press("Enter");
    await panel.getByRole("button", { name: "Flip horizontal" }).click();
    await panel.getByRole("button", { name: "Flip vertical" }).click();
    await page.keyboard.press("Escape");
    // where the handle is, turned back by the element's rotation: above its centre means "at the top"
    const above = await page.evaluate(() => {
      type N = { getClientRect(): { x: number; y: number; width: number; height: number }; getAbsolutePosition(): { x: number; y: number }; rotation(): number };
      type Tr = N & { findOne(sel: string): N; nodes(): N[] };
      const konva = (window as unknown as { Konva: { stages: { find(sel: string): Tr[] }[] } }).Konva;
      const tr = konva.stages.flatMap((s) => s.find("Transformer")).find((t) => t.nodes().length === 1)!;
      const r = tr.nodes()[0].getClientRect();
      const centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      const handle = tr.findOne(".rotater").getAbsolutePosition();
      const a = (-tr.nodes()[0].rotation() * Math.PI) / 180;
      const dx = handle.x - centre.x;
      const dy = handle.y - centre.y;
      return dx * Math.sin(a) + dy * Math.cos(a) < 0;
    });
    expect(above).toBe(true);
    const [rect] = await elements(page);
    expect([rect.rotation, rect.flip_x, rect.flip_y]).toEqual([30, true, true]);
  });

  test("the size error uses the chosen unit", async ({ page }) => {
    await signUp(page);
    await page.getByRole("button", { name: "Create a design" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a design" });
    await dialog.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: "in", exact: true }).click();
    await dialog.getByLabel("Width").fill("100");
    await dialog.getByLabel("Width").press("Tab");
    await expect(dialog.getByRole("alert")).toHaveText("Each side must be 0.42–83.33 in.");
    await dialog.getByLabel("Width").fill("83.33"); // the largest size it names is allowed
    await dialog.getByLabel("Width").press("Tab");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
  });

  test("the Projects sort is remembered", async ({ page }) => {
    await signUp(page);
    await openProjects(page);
    await page.getByRole("combobox", { name: "Sort by" }).click();
    await page.getByRole("option", { name: "Title A–Z" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
    await openProjects(page);
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveText("Title A–Z");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveText("Title A–Z");
  });

  test("Make a copy from a design card", async ({ page }) => {
    await signUp(page);
    await page.getByRole("button", { name: `More actions for ${SAMPLE}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Make a copy", exact: true }).click();
    await expect(page.getByText(`Made a copy of "${SAMPLE}"`, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `Open ${SAMPLE} (copy)` }).click();
    await expect(elementList(page)).toHaveCount(4); // the same elements as the sample
  });

  test("a broken image file gets a plain error", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Uploads" }).click();
    await page.getByLabel("Choose images to upload").setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not really a picture") });
    await expect(page.getByRole("alert")).toHaveText("broken.png: this file isn't a valid image.");
  });
});
