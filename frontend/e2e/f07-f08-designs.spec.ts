// F07 Come back later, F08 Organise (Home S02, Projects S05, editor File menu).
import { createDesign, designId, elementList, expect, expectAccessible, saved, signUp, stored, test } from "./fixtures";

test.describe("F07 come back later", () => {
  test("F07-H1 edit, go Home, reopen from Home: the edit is there", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Add a heading" }).click();
    await page.getByRole("button", { name: "Home" }).click(); // leaving saves what's left
    await page.getByRole("link", { name: "Open Untitled design" }).click();
    await expect(elementList(page)).toHaveText([/^Text: /]);
  });

  test("F07-E3 a design moved to Trash opens read-only, and Restore makes it editable", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    const id = designId(page);
    await page.getByRole("button", { name: "File" }).click();
    await page.getByRole("menuitem", { name: "Move to Trash" }).click();
    await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
    await expect(page.getByText('Moved "Untitled design" to Trash', { exact: true })).toBeVisible();

    await page.goto(`/design/${id}/edit`);
    await expect(page.getByText("In Trash: read only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a heading" })).toBeDisabled();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("button", { name: "Add a heading" })).toBeEnabled();
    expect((await stored(page, id))?.deleted_at).toBeNull();
  });

  test("F07-E5 rename from the editor's title", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Untitled design. Rename" }).click();
    const field = page.getByRole("textbox", { name: "Design title" });
    await field.fill("Café poster 🎨");
    await field.press("Enter");
    await expect(page.getByRole("button", { name: "Café poster 🎨. Rename" })).toBeVisible();
    await saved(page);
    await expect.poll(async () => (await stored(page, designId(page)))?.title).toBe("Café poster 🎨");
  });
});

test.describe("F08 organise", () => {
  test("F08-H1 Projects: rename a design, sort by title, move to Trash and undo", async ({ page }) => {
    await signUp(page);
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "More actions for Sample: launch poster" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename design" });
    await expect(dialog.getByLabel("Title")).toBeFocused();
    await expectAccessible(page);
    await dialog.getByLabel("Title").fill("A poster");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: "Open A poster" })).toBeVisible();

    // a second design to sort against
    await page.getByRole("link", { name: "Home" }).click();
    await createDesign(page);
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("combobox", { name: "Sort by" }).click();
    await page.getByRole("option", { name: "Title A–Z" }).click();
    // the list reloads after the sort changes
    await expect
      .poll(() => page.getByRole("link", { name: /^Open / }).evaluateAll((links) => links.map((a) => a.getAttribute("aria-label"))))
      .toEqual(["Open A poster", "Open Untitled design"]);

    await page.getByRole("button", { name: "More actions for A poster" }).click();
    await page.getByRole("menuitem", { name: "Move to Trash" }).click();
    await expect(page.getByRole("link", { name: "Open A poster" })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name: "Open A poster" })).toBeVisible();
  });

  test("F08-E7 an empty title can't be saved", async ({ page }) => {
    await signUp(page);
    await page.getByRole("button", { name: "More actions for Sample: launch poster" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename design" });
    await dialog.getByLabel("Title").fill("   ");
    await expect(dialog.getByText("Give it a name.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
