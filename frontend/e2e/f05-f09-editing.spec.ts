// F05 Arrange a layout, F06 pages and PDF, F09 Fix a mistake (all in the editor, S08).
import { readFile } from "node:fs/promises";
import { createDesign, designId, elementList, expect, expectAccessible, saved, signUp, stored, test } from "./fixtures";

test.describe("F05 arrange", () => {
  test("F05-H1 select all, group, ungroup; the group is saved", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Elements" }).click();
    await page.getByRole("button", { name: "Add a rectangle" }).click();
    await page.getByRole("button", { name: "Add an ellipse" }).click();
    await expect(elementList(page)).toHaveText(["Ellipse", "Rectangle"]);

    await page.keyboard.press("Control+A");
    await page.keyboard.press("Control+G");
    await expect(elementList(page)).toHaveText(["Group of 2"]);
    await saved(page);
    const grouped = await stored(page, designId(page));
    expect(grouped?.content.pages[0].elements.map((el) => [el.type, el.children?.length])).toEqual([["group", 2]]);
    await expectAccessible(page); // with the group toolbar showing

    await page.keyboard.press("Control+Shift+G");
    await expect(elementList(page)).toHaveText(["Ellipse", "Rectangle"]);
  });

  test("F05-E5 arrow keys nudge 1 px, Shift+arrow 10 px, and one undo takes back a held key", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Elements" }).click();
    await page.getByRole("button", { name: "Add a rectangle" }).click();
    await saved(page);
    const id = designId(page);
    const start = (await stored(page, id))!.content.pages[0].elements[0];

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Shift+ArrowUp");
    await saved(page);
    const moved = (await stored(page, id))!.content.pages[0].elements[0];
    expect([moved.x - start.x, moved.y - start.y]).toEqual([-1, -10]);

    await page.keyboard.press("Control+Z");
    await page.keyboard.press("Control+Z");
    await saved(page);
    const back = (await stored(page, id))!.content.pages[0].elements[0];
    expect([back.x, back.y]).toEqual([start.x, start.y]);
  });

  test("F05-E6 Delete removes the selection, and undo brings it back", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.keyboard.press("Delete");
    await expect(elementList(page)).toHaveCount(0);
    await page.keyboard.press("Control+Z");
    await expect(elementList(page)).toHaveText([/^Text: /]);
  });
});

test.describe("F06 pages", () => {
  test("F06-H1 add, duplicate and delete pages; PDF of chosen pages", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await expect(page.getByRole("button", { name: "A design needs at least one page" })).toBeDisabled();

    await page.getByRole("button", { name: "Duplicate page 1" }).click();
    await page.getByRole("button", { name: "Add a page after page 2" }).click();
    await expect(page.getByRole("button", { name: /^Page \d$/ })).toHaveText(["Page 1", "Page 2", "Page 3"]);
    await page.getByRole("button", { name: "Delete page 3" }).click();
    await expect(page.getByRole("button", { name: /^Page \d$/ })).toHaveText(["Page 1", "Page 2"]);
    await saved(page);
    const design = await stored(page, designId(page));
    expect(design?.content.pages.map((p) => p.elements.length)).toEqual([1, 1]); // the copy has the heading too

    await page.getByRole("button", { name: "Download" }).click();
    const panel = page.getByRole("dialog", { name: "Download" });
    await panel.getByRole("combobox", { name: "File type" }).click();
    await page.getByRole("option", { name: /PDF/ }).click();
    await expect(panel.getByRole("button", { name: "Download 2 pages" })).toBeEnabled();
    await expectAccessible(page);

    // F06-E4: no pages chosen, nothing to download
    await panel.getByRole("checkbox", { name: "All pages" }).click();
    await expect(panel.getByRole("button", { name: "Download 0 pages" })).toBeDisabled();
    await panel.getByRole("checkbox", { name: "Page 2" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Download 1 page" }).click()]);
    expect(download.suggestedFilename()).toBe("Untitled design.pdf");
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

test.describe("F09 fix a mistake", () => {
  test("F09-H1 undo and redo, with the buttons and the keys", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(elementList(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(elementList(page)).toHaveText([/^Text: /]);
    await page.keyboard.press("Control+Z");
    await expect(elementList(page)).toHaveCount(0);
    await page.keyboard.press("Control+Shift+Z");
    await expect(elementList(page)).toHaveText([/^Text: /]);
  });

  test("F09-E1 undo after the autosave is saved too", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await saved(page);
    await page.keyboard.press("Control+Z");
    await saved(page);
    expect((await stored(page, designId(page)))?.content.pages[0].elements).toEqual([]);
  });

  test("F09-E2 undo takes back an added page", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a page after page 1" }).click();
    await expect(page.getByRole("button", { name: /^Page \d$/ })).toHaveCount(2);
    await page.keyboard.press("Control+Z");
    await expect(page.getByRole("button", { name: /^Page \d$/ })).toHaveCount(1);
  });
});
