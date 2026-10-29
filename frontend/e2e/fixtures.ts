// Shared by every spec. Each test:
// - fails on a console error, an uncaught error or any 5xx response
// - fails if anything calls Supabase (the tests run on fake data only)
// - can run an axe accessibility scan of the screen it's on
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export const TEST_PASSWORD = "e2e-test-password";

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console error: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} on ${r.url()}`);
      });
      await page.route(/supabase\.co/, (route) => {
        problems.push(`called Supabase: ${route.request().url()}`);
        return route.abort();
      });
      await use(problems);
      expect(problems, "console errors, 5xx or Supabase calls during the test").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** axe scan of what's on screen now; lists each rule broken and where. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help} @ ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(found, "axe accessibility violations").toEqual([]);
}

let count = 0;
export function newEmail() {
  return `e2e-${Date.now()}-${count++}@example.test`;
}

/** A fresh account (fake data seeds one sample design); ends on Home. */
export async function signUp(page: Page, email = newEmail()) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /What will you make\?/ })).toBeVisible();
  return email;
}

/** Create a design with a custom size from Home; ends in the editor. */
export async function createDesign(page: Page, width = 1200, height = 628) {
  await page.getByRole("button", { name: "Create a design" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a design" });
  await dialog.getByLabel("Width").fill(String(width));
  await dialog.getByLabel("Width").press("Tab");
  await dialog.getByLabel("Height").fill(String(height));
  await dialog.getByLabel("Height").press("Tab");
  await dialog.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/design\/[^/]+\/edit$/);
  await expect(page.getByText("Saved")).toBeVisible();
}

/** The editor's element list (for screen readers): one button per element on the active page. */
export function elementList(page: Page) {
  return page.getByRole("heading", { name: /^On page \d+, top first$/ }).locator("..").getByRole("button");
}

/** The design id from the editor's address. */
export function designId(page: Page) {
  const m = new URL(page.url()).pathname.match(/^\/design\/([^/]+)\/edit$/);
  if (!m) throw new Error(`not in the editor: ${page.url()}`);
  return m[1];
}

interface StoredElement {
  id: string;
  type: string;
  kind?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flip_x: boolean;
  flip_y: boolean;
  locked: boolean;
  text?: string;
  children?: StoredElement[];
}
export interface StoredDesign {
  title: string;
  width_px: number;
  height_px: number;
  revision: number;
  deleted_at: string | null;
  content: { pages: { elements: StoredElement[] }[] };
}

/** What the fake data layer saved (the browser's IndexedDB): what a reload would show. */
export async function stored(page: Page, id: string): Promise<StoredDesign | undefined> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("canva-clone-fake");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<StoredDesign | undefined>((resolve, reject) => {
        const req = db.transaction("designs").objectStore("designs").get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }, id);
}

/** Pretends a design was moved to Trash `days` ago (fake data), to test the 30-day clean-up. */
export async function backdateTrash(page: Page, id: string, days: number) {
  await page.evaluate(
    async ([id, days]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("canva-clone-fake");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const store = db.transaction("designs", "readwrite").objectStore("designs");
        const row = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const req = store.get(id as string);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        row.deleted_at = new Date(Date.now() - (days as number) * 86_400_000).toISOString();
        await new Promise<void>((resolve, reject) => {
          const req = store.put(row);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    },
    [id, days] as const,
  );
}

/** The id of a design, from its card's link on Home, Projects or a folder. */
export async function cardDesignId(page: Page, title: string) {
  const href = await page.getByRole("link", { name: `Open ${title}`, exact: true }).getAttribute("href");
  const m = href?.match(/^\/design\/([^/]+)\/edit$/);
  if (!m) throw new Error(`no card for "${title}"`);
  return m[1];
}

/** No sideways scrolling at the current width. */
export async function expectNoSidewaysScroll(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, "page scrolls sideways").toBe(0);
}

/** Width and height of a PNG file, from its header. */
export function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Waits until the autosave has caught up. */
export async function saved(page: Page) {
  await expect(page.getByText("Saving…")).toHaveCount(0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

/** A plain red PNG made by the browser itself, so the test needs no image files. */
export async function redPng(page: Page, width = 300, height = 200) {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL("image/png").split(",")[1];
    },
    [width, height],
  );
  return Buffer.from(base64, "base64");
}
