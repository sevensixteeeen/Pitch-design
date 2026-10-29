// F05 Arrange: the Position panel (S13 Arrange), lock, and the Layers list (S13 Layers), milestone 3b.
import type { Page } from "@playwright/test";
import { createDesign, designId, elementList, expect, expectAccessible, redPng, saved, signUp, stored, test } from "./fixtures";

async function add(page: Page, ...shapes: string[]) {
  await page.getByRole("tab", { name: "Elements" }).click();
  for (const shape of shapes) await page.getByRole("button", { name: `Add ${shape}` }).click();
}

async function first(page: Page) {
  await saved(page);
  return (await stored(page, designId(page)))!.content.pages[0].elements;
}

function layerList(page: Page) {
  return page.getByRole("list", { name: /^Layers on page \d+, top first$/ });
}

function layers(page: Page) {
  return layerList(page).getByRole("listitem");
}

/** A row's name button in the Layers list (the editor's hidden keyboard list has the same names). */
function layer(page: Page, name: string) {
  return layerList(page).getByRole("button", { name, exact: true });
}

/** Types into a box of the Position panel and leaves it with Enter. */
async function type(page: Page, label: string, value: string) {
  const box = page.getByRole("dialog", { name: "Position" }).getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press("Enter");
}

test.describe("F05 Position panel", () => {
  test("F05-H2 type X, Y, width, height and rotation; flip; one undo per change", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await add(page, "a rectangle");
    await page.getByRole("button", { name: "Position" }).click();
    await expect(page.getByRole("dialog", { name: "Position" })).toBeVisible();
    await expectAccessible(page);

    await type(page, "X", "100");
    await type(page, "Y", "50");
    await type(page, "Width", "300");
    await type(page, "Height", "200");
    await type(page, "Rotation", "405"); // a full turn plus 45
    let [rect] = await first(page);
    expect([rect.x, rect.y, rect.width, rect.height, rect.rotation]).toEqual([100, 50, 300, 200, 45]);

    await page.getByRole("button", { name: "Flip horizontal" }).click();
    [rect] = await first(page);
    expect([rect.flip_x, rect.flip_y]).toEqual([true, false]);

    await page.keyboard.press("Escape"); // closes the panel
    await page.keyboard.press("Control+Z"); // the flip
    await page.keyboard.press("Control+Z"); // the rotation
    [rect] = await first(page);
    expect([rect.flip_x, rect.rotation, rect.height]).toEqual([false, 0, 200]);
  });

  test("F05-E7 a photo keeps its proportions; a text box's height follows its text", async ({ page }) => {
    await signUp(page);
    await createDesign(page, 1200, 628);
    await page.getByRole("tab", { name: "Uploads" }).click();
    await page.getByLabel("Choose images to upload").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: await redPng(page, 300, 200) });
    await page.getByRole("button", { name: "Add red.png to the page" }).click();
    await page.getByRole("button", { name: "Position" }).click();
    await expect(page.getByRole("dialog", { name: "Position" })).toContainText("Photos keep their proportions");
    await type(page, "Width", "150");
    let [img] = await first(page);
    expect([img.width, img.height]).toEqual([150, 100]);
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: "Text" }).click();
    await page.getByRole("button", { name: "Add some body text" }).click();
    await page.getByRole("button", { name: "Position" }).click();
    const height = page.getByRole("dialog", { name: "Position" }).getByLabel("Height", { exact: true });
    await expect(height).toBeDisabled();
    await expect(page.getByRole("dialog", { name: "Position" })).toContainText("Follows the text");
    const before = (await first(page))[1];
    await type(page, "Width", "60"); // a word or two per line
    const after = (await first(page))[1];
    expect(after.height).toBeGreaterThan(before.height); // narrower box, more lines
  });

  test("F05-E8 tabbing through the boxes without typing changes nothing", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await add(page, "a rectangle");
    await saved(page);
    const revision = (await stored(page, designId(page)))!.revision;
    await page.getByRole("button", { name: "Position" }).click();
    const dialog = page.getByRole("dialog", { name: "Position" });
    await dialog.getByLabel("X", { exact: true }).focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await saved(page);
    expect((await stored(page, designId(page)))!.revision).toBe(revision);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled(); // only the "add" to undo
    await page.keyboard.press("Control+Z");
    await expect(elementList(page)).toHaveCount(0);
  });
});

test.describe("F05 lock", () => {
  test("F05-E2 a locked element can't move or be deleted, until it's unlocked", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await add(page, "a rectangle");
    const [start] = await first(page);

    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByRole("toolbar", { name: "Selected element" })).toContainText("RectangleLocked");
    await expect(page.getByRole("button", { name: "Unlock", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Position" })).toHaveCount(0); // nothing to arrange while locked
    await expectAccessible(page);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Delete");
    let [rect] = await first(page);
    expect([rect.locked, rect.x]).toEqual([true, start.x]);
    await expect(elementList(page)).toHaveText(["Rectangle"]);

    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    [rect] = await first(page);
    expect([rect.locked, rect.x]).toEqual([false, start.x + 1]);
    await page.keyboard.press("Delete");
    await expect(elementList(page)).toHaveCount(0);
  });
});

test.describe("F05 Layers", () => {
  test("F05-H3 the Layers tab lists the page top first; select, lock and reorder from it", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("tab", { name: "Layers" }).click();
    await expect(page.getByText("Nothing on page 1 yet.")).toBeVisible();

    await add(page, "a rectangle", "an ellipse", "a triangle");
    await page.getByRole("tab", { name: "Layers" }).click();
    await expect(layers(page)).toHaveText(["Triangle", "Ellipse", "Rectangle"]);
    await expectAccessible(page);

    // select from the list
    await layer(page, "Rectangle").click();
    await expect(layer(page, "Rectangle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("toolbar", { name: "Selected element" })).toContainText("Rectangle");

    // keyboard: Alt+Up moves it one layer up (it stays focused); the arrow doesn't nudge it
    const x = (await first(page))[0].x;
    await page.keyboard.press("Alt+ArrowUp");
    await expect(layers(page)).toHaveText(["Triangle", "Rectangle", "Ellipse"]);
    await expect(layer(page, "Rectangle")).toBeFocused();
    const els = await first(page);
    expect(els.map((el) => el.kind)).toEqual(["ellipse", "rect", "triangle"]); // back to front
    expect(els[1].x).toBe(x);

    // lock from the row
    await page.getByRole("button", { name: "Lock Ellipse" }).click();
    await expect(page.getByRole("button", { name: "Unlock Ellipse" })).toHaveAttribute("aria-pressed", "true");
    expect((await first(page)).find((el) => el.kind === "ellipse")?.locked).toBe(true);

    // drag the top layer to the bottom
    const rows = layers(page);
    const last = await rows.nth(2).boundingBox();
    await rows.nth(0).dragTo(rows.nth(2), { targetPosition: { x: 20, y: last!.height - 3 } });
    await expect(layers(page)).toHaveText(["Rectangle", "Ellipse", "Triangle"]);
    expect((await first(page)).map((el) => el.kind)).toEqual(["triangle", "ellipse", "rect"]);
    await page.keyboard.press("Control+Z");
    await expect(layers(page)).toHaveText(["Triangle", "Rectangle", "Ellipse"]);
  });
});
