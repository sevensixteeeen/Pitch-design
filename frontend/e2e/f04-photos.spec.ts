// F04 Use my own photo (S08 -> S11): upload, place, download with the photo in it.
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { createDesign, elementList, expect, expectAccessible, redPng, saved, signUp, test } from "./fixtures";

/** The colour at (x, y) of a PNG file, read back by the browser. */
async function pixel(page: Page, png: Buffer, x: number, y: number) {
  return page.evaluate(
    async ([b64, x, y]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(Number(x), Number(y), 1, 1).data.slice(0, 3)];
    },
    [png.toString("base64"), x, y] as const,
  );
}

test.describe("F04 photos", () => {
  test("F04-H1 upload a photo, place it, and the PNG download has it", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await page.getByRole("tab", { name: "Uploads" }).click();
    await expect(page.getByText("No uploads yet")).toBeVisible();
    await expectAccessible(page);

    await page.getByLabel("Choose images to upload").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page) });
    await page.getByRole("button", { name: "Add red.png to the page" }).click();
    await expect(elementList(page)).toHaveText(["Image"]);
    await saved(page);

    await page.getByRole("button", { name: "Download" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("dialog", { name: "Download" }).getByRole("button", { name: "Download" }).click(),
    ]);
    const png = await readFile(await download.path());
    // the photo is placed in the middle of the page; the corner is the white page
    expect(await pixel(page, png, 600, 314)).toEqual([255, 0, 0]);
    expect(await pixel(page, png, 5, 5)).toEqual([255, 255, 255]);
  });

  test("F04-E2 a file that isn't a PNG, JPG or WebP is refused with a message", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Uploads" }).click();
    await page.getByLabel("Choose images to upload").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert")).toHaveText("notes.txt: use a PNG, JPG or WebP image.");
    await expect(page.getByText("No uploads yet")).toBeVisible();
  });
});
