// Milestone 3e: crop a photo (S17) and text effects (S16).
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { createDesign, designId, elementList, expect, expectAccessible, pixel, saved, signUp, stored, test } from "./fixtures";

/** A 300 × 200 PNG: left half red, right half blue. */
async function twoColourPng(page: Page) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 150, 200);
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(150, 0, 150, 200);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

/** Screen position of a point given in design px (page 1). */
async function onScreen(page: Page, x: number, y: number, designWidth: number) {
  const box = (await page.getByRole("region", { name: /^Page 1 of \d+$/ }).locator("div[aria-hidden]").first().boundingBox())!;
  const k = box.width / designWidth;
  return { x: box.x + x * k, y: box.y + y * k };
}

async function placePhoto(page: Page) {
  await createDesign(page, 1200, 628);
  await page.getByRole("tab", { name: "Uploads" }).click();
  await page.getByLabel("Choose images to upload").setInputFiles({ name: "two.png", mimeType: "image/png", buffer: await twoColourPng(page) });
  await page.getByRole("button", { name: "Add two.png to the page" }).click();
  await expect(elementList(page)).toHaveText(["Image"]);
  await saved(page); // the photo sits at 450, 214, 300 × 200
}

async function photo(page: Page) {
  await saved(page);
  return (await stored(page, designId(page)))!.content.pages[0].elements[0] as unknown as {
    x: number;
    y: number;
    width: number;
    height: number;
    crop?: { x: number; y: number; width: number; height: number } | null;
  };
}

test.describe("S17 crop", () => {
  test("S17-H1 drag the frame's side in, Done: the photo is cropped, also in the download", async ({ page }) => {
    await signUp(page);
    await placePhoto(page);
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await expect(page.getByRole("toolbar", { name: "Crop" })).toBeVisible();
    await expectAccessible(page);

    // the right side's handle, from the photo's right edge (x 750) to the middle (x 600)
    const from = await onScreen(page, 750, 314, 1200);
    const to = await onScreen(page, 600, 314, 1200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("toolbar", { name: "Crop" })).toHaveCount(0);

    const p = await photo(page);
    expect(p.x).toBe(450);
    expect(p.width).toBeGreaterThan(140);
    expect(p.width).toBeLessThan(160);
    expect(p.crop!.x).toBe(0);
    expect(p.crop!.width).toBeCloseTo(p.width / 300, 2);

    await page.getByRole("button", { name: "Download" }).click();
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("dialog", { name: "Download" }).getByRole("button", { name: "Download" }).click(),
    ]);
    const png = await readFile(await file.path());
    expect(await pixel(page, png, 500, 314)).toEqual([255, 0, 0]); // the red half stays
    expect(await pixel(page, png, 700, 314)).toEqual([255, 255, 255]); // the blue half is cut off

    // one undo step brings the whole photo back
    await page.keyboard.press("Control+Z");
    expect((await photo(page)).width).toBe(300);
  });

  test("S17-E1 Escape cancels; Reset shows the whole photo again; double-click opens crop mode", async ({ page }) => {
    await signUp(page);
    await placePhoto(page);
    const centre = await onScreen(page, 600, 314, 1200);
    await page.mouse.dblclick(centre.x, centre.y);
    await expect(page.getByRole("toolbar", { name: "Crop" })).toBeVisible();
    const from = await onScreen(page, 600, 414, 1200); // the bottom side's handle
    const to = await onScreen(page, 600, 330, 1200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("toolbar", { name: "Crop" })).toHaveCount(0);
    expect((await photo(page)).height).toBe(200); // unchanged

    // crop for real, then Reset and Done: no crop left
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.press("Enter");
    expect((await photo(page)).crop).not.toBeNull();
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    const p = await photo(page);
    expect([p.width, p.height, p.crop ?? null]).toEqual([300, 200, null]);
  });
});

test.describe("S17 crop, turned", () => {
  test("S17-E2 a photo turned 90°: the kept part stays where it was on the page", async ({ page }) => {
    await signUp(page);
    await placePhoto(page);
    await page.getByRole("button", { name: "Position" }).click();
    const rotation = page.getByRole("dialog", { name: "Position" }).getByLabel("Rotation", { exact: true });
    await rotation.fill("90");
    await rotation.press("Enter");
    await page.keyboard.press("Escape");
    // turned a quarter clockwise around its centre (600, 314): red on top, blue below, x 500–700
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    // the photo's own right side (blue) is now at the bottom: drag that handle up to the middle
    const from = await onScreen(page, 600, 464, 1200);
    const to = await onScreen(page, 600, 314, 1200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: "Download" }).click();
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("dialog", { name: "Download" }).getByRole("button", { name: "Download" }).click(),
    ]);
    const png = await readFile(await file.path());
    expect(await pixel(page, png, 600, 230)).toEqual([255, 0, 0]); // the red part, still at the top
    expect(await pixel(page, png, 600, 420)).toEqual([255, 255, 255]); // the blue part is gone
  });
});

test.describe("S16 text effects", () => {
  test("S16-H1 shadow and outline on, adjusted, then off again", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Effects" }).click();
    const panel = page.getByRole("dialog", { name: "Effects" });
    await panel.getByRole("checkbox", { name: "Shadow" }).click();
    await expect(panel.getByRole("slider", { name: "Blur" })).toBeVisible();
    await expectAccessible(page);

    const text = async () => {
      await saved(page);
      return (await stored(page, designId(page)))!.content.pages[0].elements[0] as unknown as {
        shadow?: { blur: number; offset_x: number; offset_y: number } | null;
        outline?: { width: number } | null;
      };
    };
    const before = (await text()).shadow!;
    await panel.getByRole("slider", { name: "Blur" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect((await text()).shadow!.blur).toBe(Math.round(before.blur) + 2);

    await panel.getByRole("checkbox", { name: "Outline" }).click();
    expect((await text()).outline!.width).toBeGreaterThan(0);

    await panel.getByRole("checkbox", { name: "Shadow" }).click();
    const after = await text();
    expect(after.shadow ?? null).toBeNull();
    expect(after.outline).not.toBeNull();
    await expect(page.getByRole("button", { name: "Effects" })).toHaveAttribute("aria-pressed", "true"); // the outline is still on
  });
});
