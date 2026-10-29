// F08 Organise: folders (S05, S06) and Trash (S07), milestone 3a.
import type { Page } from "@playwright/test";
import { backdateTrash, cardDesignId, createDesign, expect, expectAccessible, expectNoSidewaysScroll, signUp, test } from "./fixtures";

const SAMPLE = "Sample: launch poster";

async function openProjects(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
}

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "New folder" }).click();
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await expect(dialog.getByLabel("Folder name")).toBeFocused();
  await dialog.getByLabel("Folder name").fill(name);
  await dialog.getByRole("button", { name: "Create folder" }).click();
  await expect(dialog).toHaveCount(0);
}

async function cardMenu(page: Page, title: string, item: string) {
  await page.getByRole("button", { name: `More actions for ${title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

async function moveTo(page: Page, title: string, folderOption: string) {
  await cardMenu(page, title, "Move to folder…");
  const dialog = page.getByRole("dialog", { name: "Move to folder" });
  await dialog.getByRole("combobox", { name: "Folder" }).click();
  await page.getByRole("option", { name: folderOption, exact: true }).click();
  await dialog.getByRole("button", { name: "Move" }).click();
  await expect(dialog).toHaveCount(0);
}

function folderCard(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true }).locator("xpath=ancestor::div[contains(@class,'group')][1]");
}

test.describe("F08 folders", () => {
  test("F08-H2 make a folder, move a design in, open it, rename it, delete it (the design stays)", async ({ page }) => {
    await signUp(page);
    await openProjects(page);
    await expect(page.getByText("No folders yet.")).toBeVisible();

    const name = "Clients 💼 — São Paulo";
    await newFolder(page, name);
    await expect(folderCard(page, name)).toContainText("0 designs");

    await moveTo(page, SAMPLE, name);
    await expect(folderCard(page, name)).toContainText("1 design");
    await expectAccessible(page);

    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(`Projects${name}`);
    await expect(page.getByRole("link", { name: `Open ${SAMPLE}` })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Rename", exact: true }).click();
    const rename = page.getByRole("dialog", { name: "Rename folder" });
    await rename.getByLabel("Folder name").fill("Clients");
    await rename.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clients");

    await page.getByRole("button", { name: "Delete folder" }).click();
    const confirm = page.getByRole("dialog", { name: 'Delete the folder "Clients"?' });
    await expect(confirm).toContainText("The design in it won't be deleted: it stays in Projects");
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused(); // the safe choice
    await expectAccessible(page);
    await confirm.getByRole("button", { name: "Delete folder" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("No folders yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: `Open ${SAMPLE}` })).toBeVisible();
  });

  test("F08-E9 Move to folder can make a new folder, and take the design out again", async ({ page }) => {
    await signUp(page);
    await openProjects(page);
    await cardMenu(page, SAMPLE, "Move to folder…");
    const dialog = page.getByRole("dialog", { name: "Move to folder" });
    await expect(dialog.getByRole("button", { name: "Move" })).toBeDisabled(); // nothing changed yet
    await dialog.getByRole("combobox", { name: "Folder" }).click();
    await page.getByRole("option", { name: "New folder…" }).click();
    await dialog.getByLabel("New folder name").fill("Posters");
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Move" }).click();
    await expect(folderCard(page, "Posters")).toContainText("1 design");

    await page.getByRole("link", { name: "Posters", exact: true }).click();
    await moveTo(page, SAMPLE, "No folder (only in Projects)");
    await expect(page.getByRole("heading", { name: "This folder is empty" })).toBeVisible();
    await expectAccessible(page);
  });

  test("F08-N3 a folder that isn't yours (or doesn't exist) shows the not-found page", async ({ page }) => {
    await signUp(page);
    await page.goto(`/folders/${crypto.randomUUID()}`);
    await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
  });

  test("F08-E10 a 60-character folder name, on a 390 px wide screen", async ({ page }) => {
    await signUp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProjects(page);
    const long = "A folder with a really long name, for testing how it wraps!!";
    expect(long).toHaveLength(60);
    await newFolder(page, long);
    await moveTo(page, SAMPLE, long);
    await expectNoSidewaysScroll(page);
    await page.getByRole("link", { name: long, exact: true }).click();
    await expect(page.getByRole("heading", { name: long, level: 1 })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectAccessible(page);
  });

  test("F08-E11 keyboard only: make a folder and move a design into it", async ({ page }) => {
    await signUp(page);
    await openProjects(page);
    await page.getByRole("button", { name: "New folder" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Folder name")).toBeFocused();
    await page.keyboard.type("Drafts");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "New folder" })).toBeFocused(); // focus comes back
    await expect(folderCard(page, "Drafts")).toContainText("0 designs");

    const more = page.getByRole("button", { name: `More actions for ${SAMPLE}`, exact: true });
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Rename" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter"); // Move to folder…
    const folderBox = page.getByRole("dialog", { name: "Move to folder" }).getByRole("combobox", { name: "Folder" });
    await expect(folderBox).toBeFocused();
    await page.keyboard.press("Enter"); // open the list; the current choice gets focus
    await expect(page.getByRole("option", { name: "No folder (only in Projects)" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "Drafts" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(folderBox).toHaveText("Drafts");
    await page.keyboard.press("Tab"); // Cancel
    await page.keyboard.press("Tab"); // Move
    await page.keyboard.press("Enter");
    await expect(folderCard(page, "Drafts")).toContainText("1 design");
    await expect(more).toBeFocused(); // back where the user started
  });
});

test.describe("F08 Trash", () => {
  test("F08-H3 move to Trash, restore, then delete forever; its link then shows not found", async ({ page }) => {
    await signUp(page);
    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
    await expectAccessible(page);

    await openProjects(page);
    const id = await cardDesignId(page, SAMPLE);
    await cardMenu(page, SAMPLE, "Move to Trash");
    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByText(SAMPLE, { exact: true })).toBeVisible();
    await expect(page.getByText("Deletes in 30 days")).toBeVisible();
    await expectAccessible(page);

    await cardMenu(page, SAMPLE, "Restore");
    await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
    await openProjects(page);
    await expect(page.getByRole("link", { name: `Open ${SAMPLE}` })).toBeVisible();

    await cardMenu(page, SAMPLE, "Move to Trash");
    await page.getByRole("link", { name: "Trash" }).click();
    await cardMenu(page, SAMPLE, "Delete forever");
    const confirm = page.getByRole("dialog", { name: `Delete "${SAMPLE}" forever?` });
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expectAccessible(page);
    await confirm.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();

    await page.goto(`/design/${id}/edit`);
    await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
  });

  test("F08-E3 after 30 days in Trash a design is deleted for good; one day left says so", async ({ page }) => {
    await signUp(page);
    await createDesign(page);
    await page.getByRole("button", { name: "Home" }).click();
    await openProjects(page);
    const sample = await cardDesignId(page, SAMPLE);
    const untitled = await cardDesignId(page, "Untitled design");
    await cardMenu(page, SAMPLE, "Move to Trash");
    await cardMenu(page, "Untitled design", "Move to Trash");
    await expect(page.getByRole("link", { name: /^Open / })).toHaveCount(0);
    await backdateTrash(page, sample, 31);
    await backdateTrash(page, untitled, 29);

    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByText("Untitled design", { exact: true })).toBeVisible();
    await expect(page.getByText("Deletes tomorrow")).toBeVisible();
    await expect(page.getByText(SAMPLE, { exact: true })).toHaveCount(0);
    await page.goto(`/design/${sample}/edit`);
    await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
  });

  test("F08-E12 Trash on a 390 px wide screen", async ({ page }) => {
    await signUp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProjects(page);
    await cardMenu(page, SAMPLE, "Move to Trash");
    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByText(SAMPLE, { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});
