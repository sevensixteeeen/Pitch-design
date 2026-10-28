// F02 Core loop: blank custom-size design -> text and a shape -> PNG (S02 -> S03 -> S08 -> S20).
import { readFile } from "node:fs/promises";
import { createDesign, designId, elementList, expect, expectAccessible, pngSize, saved, signUp, stored, test } from "./fixtures";

test.describe("F02 core loop", () => {
  test("F02-H1 custom size, heading and rectangle, saved, PNG at the design's size", async ({ page }) => {
    await signUp(page);
    await expectAccessible(page); // Home
    await page.getByRole("button", { name: "Create a design" }).click();
    await expectAccessible(page); // the size picker open
    await page.keyboard.press("Escape");

    await createDesign(page, 1200, 628);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("tab", { name: "Elements" }).click();
    await page.getByRole("button", { name: "Add a rectangle" }).click();
    await expect(elementList(page)).toHaveText([/^Rectangle$/, /^Text: /]);
    await saved(page);
    await expectAccessible(page);

    const design = await stored(page, designId(page));
    expect(design?.width_px).toBe(1200);
    expect(design?.content.pages[0].elements.map((el) => el.type)).toEqual(["text", "shape"]);

    await page.getByRole("button", { name: "Download" }).click();
    await expectAccessible(page); // the Download panel open
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("dialog", { name: "Download" }).getByRole("button", { name: "Download" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Untitled design.png");
    expect(pngSize(await readFile(await download.path()))).toEqual({ width: 1200, height: 628 });

    // listed on Home
    await page.getByRole("button", { name: "Home" }).click();
    await expect(page.getByRole("link", { name: /Untitled design/ })).toBeVisible();
  });

  test("F02-E1 sizes out of range are refused before anything is created", async ({ page }) => {
    await signUp(page);
    await page.getByRole("button", { name: "Create a design" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a design" });
    await dialog.getByLabel("Width").fill("39");
    await dialog.getByLabel("Width").press("Tab");
    await expect(dialog.getByRole("alert")).toHaveText("Each side must be 40–8000 px.");
    await expect(dialog.getByRole("button", { name: "Create design" })).toBeDisabled();
    await dialog.getByLabel("Width").fill("8000");
    await dialog.getByLabel("Width").press("Tab");
    await dialog.getByLabel("Height").fill("8000");
    await dialog.getByLabel("Height").press("Tab");
    await expect(dialog.getByRole("alert")).toContainText("at most 25 million px");
    await expect(dialog.getByRole("button", { name: "Create design" })).toBeDisabled();
  });

  test("F02-E2 a size in mm is created in pixels, at 96 px per inch", async ({ page }) => {
    await signUp(page);
    await page.getByRole("button", { name: "Create a design" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a design" });
    await dialog.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: "mm" }).click();
    await dialog.getByLabel("Width").fill("210");
    await dialog.getByLabel("Width").press("Tab");
    await dialog.getByLabel("Height").fill("297");
    await dialog.getByLabel("Height").press("Tab");
    await expect(dialog.getByText("= 794 × 1123 px")).toBeVisible();
    await dialog.getByRole("button", { name: "Create design" }).click();
    await expect(page).toHaveURL(/\/edit$/);
    const design = await stored(page, designId(page));
    expect([design?.width_px, design?.height_px]).toEqual([794, 1123]);
  });

  test("F02-E10 the status never says Saved while an edit is still waiting to be saved", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    // the autosave waits ~1 s after the last change; until then the edit only lives in this tab,
    // so within that second the status must not say "Saved"
    await expect(page.getByText("Saved", { exact: true })).toHaveCount(0, { timeout: 500 });
    await saved(page);
  });

  test("F02-E12 refresh after the save keeps the edit", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await saved(page);
    await page.reload();
    await expect(elementList(page)).toHaveText([/^Text: /]);
  });

  test("F02-E3 closing the tab with an unsaved edit asks first", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    const dialog = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const d = await dialog;
    expect(d.type()).toBe("beforeunload");
    await d.dismiss();
  });

  test("F02-E13 a phone-sized window gets a clear note instead of the editor", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Open this on a larger screen" })).toBeVisible();
    await expectAccessible(page);
  });

  test("F02-E14 keyboard only: add text, nudge it, open Download", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).focus();
    await page.keyboard.press("Enter");
    await expect(elementList(page)).toHaveText([/^Text: /]);
    await saved(page);
    const id = designId(page);
    const before = (await stored(page, id))!.content.pages[0].elements[0];
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await saved(page);
    const after = (await stored(page, id))!.content.pages[0].elements[0];
    expect([after.x - before.x, after.y - before.y]).toEqual([1, 10]);

    await page.getByRole("button", { name: "Download" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Download" })).toBeVisible();
  });

  test("F02-N1 someone else's design id shows the not-found page", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    const id = designId(page);
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await signUp(page); // a second account in the same browser
    await page.goto(`/design/${id}/edit`);
    await expect(page.getByRole("heading", { name: /can't find/i })).toBeVisible();
  });
});
