// Fake data layer: keeps everything in this browser's IndexedDB so the editor
// works before the backend exists. Mirrors the API's rules (owner checks,
// size limits, revisions, trash) so screens behave the same when http.ts
// replaces it. NOT secure: anyone with this browser can read it.
import { assetIds, blankContent, sizeError, type DesignContent } from "../lib/document";
import { seedContent } from "./seed";
import {
  ConflictError,
  NotFoundError,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  USER_QUOTA_BYTES,
  ValidationError,
  type Asset,
  type DataLayer,
  type Design,
  type DesignSummary,
  type Folder,
  type User,
} from "./api";

const DB_NAME = "canva-clone-fake";
const STORES = ["users", "designs", "assets", "folders", "thumbnails"] as const;
type Store = (typeof STORES)[number];
const SESSION_KEY = "canva-clone-fake-session";
const LATENCY_MS = 120; // so loading states are visible while building

interface UserRow extends User {
  password_hash: string;
}
interface DesignRow extends Omit<Design, "thumbnail_url"> {
  owner_id: string;
}
interface AssetRow extends Omit<Asset, "url"> {
  owner_id: string;
  blob: Blob;
}
interface FolderRow extends Omit<Folder, "design_count"> {
  owner_id: string;
}
interface ThumbRow {
  id: string; // design id
  owner_id: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function all<T>(store: Store): Promise<T[]> {
  const tx = (await db()).transaction(store, "readonly");
  return request(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}
async function get<T>(store: Store, id: string): Promise<T | undefined> {
  const tx = (await db()).transaction(store, "readonly");
  return request(tx.objectStore(store).get(id) as IDBRequest<T | undefined>);
}
async function put<T extends { id: string }>(store: Store, row: T): Promise<void> {
  const tx = (await db()).transaction(store, "readwrite");
  await request(tx.objectStore(store).put(row));
}
async function remove(store: Store, id: string): Promise<void> {
  const tx = (await db()).transaction(store, "readwrite");
  await request(tx.objectStore(store).delete(id));
}

const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const now = () => new Date().toISOString();

// one object URL per blob, so images and thumbnails don't leak memory
const objectUrls = new Map<string, string>();
function urlFor(key: string, blob: Blob): string {
  let url = objectUrls.get(key);
  if (!url) {
    url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
  }
  return url;
}
function dropUrl(key: string) {
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}

async function hash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

async function me(): Promise<UserRow> {
  const id = sessionUserId();
  const user = id ? await get<UserRow>("users", id) : undefined;
  if (!user) throw new NotFoundError();
  return user;
}

/** Same rule as the API: a row you don't own looks exactly like a missing one. */
async function owned<T extends { owner_id: string }>(store: Store, id: string): Promise<T> {
  const user = await me();
  const row = await get<T>(store, id);
  if (!row || row.owner_id !== user.id) throw new NotFoundError();
  return row;
}

async function summary(row: DesignRow): Promise<DesignSummary> {
  const thumb = await get<ThumbRow>("thumbnails", row.id);
  const { content, owner_id: _owner, ...rest } = row;
  return { ...rest, thumbnail_url: thumb ? urlFor(`thumb:${row.id}`, thumb.blob) : null };
}

function publicUser({ password_hash: _hash, ...user }: UserRow): User {
  return user;
}

function checkContent(content: DesignContent) {
  if (!Array.isArray(content.pages) || content.pages.length < 1 || content.pages.length > 200) {
    throw new ValidationError("A design needs 1–200 pages.");
  }
}

export const fake: DataLayer = {
  async getUser() {
    const id = sessionUserId();
    const user = id ? await get<UserRow>("users", id) : undefined;
    return user ? publicUser(user) : null;
  },

  async signUp(email, password) {
    await wait();
    const clean = email.trim().toLowerCase();
    const users = await all<UserRow>("users");
    if (users.some((u) => u.email === clean)) throw new ValidationError("There's already an account with that email. Log in instead.");
    if (password.length < 8) throw new ValidationError("Use at least 8 characters for your password.");
    const user: UserRow = { id: crypto.randomUUID(), email: clean, display_name: null, password_hash: await hash(password) };
    await put("users", user);
    localStorage.setItem(SESSION_KEY, user.id);
    // seed: one sample design so Home isn't empty on day one
    const t = now();
    await put("designs", {
      id: crypto.randomUUID(),
      owner_id: user.id,
      title: "Sample: launch poster",
      width_px: 1080,
      height_px: 1350,
      display_unit: "px",
      folder_id: null,
      page_count: 1,
      revision: 1,
      deleted_at: null,
      created_at: t,
      updated_at: t,
      content: seedContent(1080, 1350),
    } satisfies DesignRow);
    return publicUser(user);
  },

  async logIn(email, password) {
    await wait();
    const users = await all<UserRow>("users");
    const user = users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.password_hash !== (await hash(password))) throw new ValidationError("That email and password don't match.");
    localStorage.setItem(SESSION_KEY, user.id);
    return publicUser(user);
  },

  async logOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  async listDesigns(query = {}) {
    await wait();
    const user = await me();
    const q = query.q?.trim().toLowerCase();
    const rows = (await all<DesignRow>("designs"))
      .filter((d) => d.owner_id === user.id)
      .filter((d) => (query.in_trash ? d.deleted_at !== null : d.deleted_at === null))
      .filter((d) => query.folder_id === undefined || d.folder_id === query.folder_id)
      .filter((d) => !q || d.title.toLowerCase().includes(q));
    rows.sort((a, b) =>
      query.sort === "title" ? a.title.localeCompare(b.title) : b.updated_at.localeCompare(a.updated_at),
    );
    return Promise.all(rows.map(summary));
  },

  async createDesign(input) {
    await wait();
    const user = await me();
    const err = sizeError(input.width_px, input.height_px);
    if (err) throw new ValidationError(err);
    if (input.id) {
      // retried create: return it if it's ours, refuse if the id is someone else's
      const existing = await get<DesignRow>("designs", input.id);
      if (existing) {
        if (existing.owner_id !== user.id) throw new ConflictError();
        return { ...(await summary(existing)), content: existing.content };
      }
    }
    const t = now();
    const row: DesignRow = {
      id: input.id ?? crypto.randomUUID(),
      owner_id: user.id,
      title: input.title?.trim() || "Untitled design",
      width_px: Math.round(input.width_px),
      height_px: Math.round(input.height_px),
      display_unit: input.display_unit,
      folder_id: null,
      page_count: 1,
      revision: 1,
      deleted_at: null,
      created_at: t,
      updated_at: t,
      content: blankContent(),
    };
    await put("designs", row);
    return { ...(await summary(row)), content: row.content };
  },

  async getDesign(id) {
    await wait();
    const row = await owned<DesignRow>("designs", id);
    const user = await me();
    const asset_urls: Record<string, string> = {};
    // images inside groups too (same rule as the API)
    for (const assetId of assetIds(row.content)) {
      const asset = await get<AssetRow>("assets", assetId);
      // only your own assets get a URL; anything else renders as "missing image"
      if (asset && asset.owner_id === user.id) asset_urls[asset.id] = urlFor(`asset:${asset.id}`, asset.blob);
    }
    return { design: { ...(await summary(row)), content: row.content }, asset_urls };
  },

  async saveContent(id, content, revision) {
    await wait();
    const row = await owned<DesignRow>("designs", id);
    if (row.deleted_at) throw new NotFoundError();
    if (row.revision !== revision) throw new ConflictError();
    checkContent(content);
    const updated: DesignRow = { ...row, content, page_count: content.pages.length, revision: row.revision + 1, updated_at: now() };
    await put("designs", updated);
    return { revision: updated.revision, updated_at: updated.updated_at };
  },

  async updateDesign(id, patch) {
    await wait();
    const row = await owned<DesignRow>("designs", id);
    const next = { ...row, updated_at: now() };
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (title.length < 1 || title.length > 255) throw new ValidationError("A title needs 1–255 characters.");
      next.title = title;
    }
    if (patch.folder_id !== undefined) {
      if (patch.folder_id !== null) await owned<FolderRow>("folders", patch.folder_id);
      next.folder_id = patch.folder_id;
    }
    await put("designs", next);
    return summary(next);
  },

  async trashDesign(id) {
    const row = await owned<DesignRow>("designs", id);
    await put("designs", { ...row, deleted_at: now() });
  },

  async restoreDesign(id) {
    const row = await owned<DesignRow>("designs", id);
    const folder = row.folder_id ? await get<FolderRow>("folders", row.folder_id) : undefined;
    await put("designs", { ...row, deleted_at: null, folder_id: folder ? row.folder_id : null });
  },

  async deleteDesign(id) {
    const row = await owned<DesignRow>("designs", id);
    if (!row.deleted_at) throw new ValidationError("Move it to Trash first.");
    await remove("designs", id);
    await remove("thumbnails", id);
    dropUrl(`thumb:${id}`);
  },

  async uploadThumbnail(id, png) {
    const row = await owned<DesignRow>("designs", id);
    await put("thumbnails", { id, owner_id: row.owner_id, blob: png } satisfies ThumbRow);
    dropUrl(`thumb:${id}`);
  },

  async listFolders() {
    await wait();
    const user = await me();
    const designs = (await all<DesignRow>("designs")).filter((d) => d.owner_id === user.id && !d.deleted_at);
    return (await all<FolderRow>("folders"))
      .filter((f) => f.owner_id === user.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ owner_id: _owner, ...f }) => ({ ...f, design_count: designs.filter((d) => d.folder_id === f.id).length }));
  },

  async createFolder(name) {
    const user = await me();
    const clean = name.trim();
    if (clean.length < 1 || clean.length > 100) throw new ValidationError("A folder name needs 1–100 characters.");
    const t = now();
    const row: FolderRow = { id: crypto.randomUUID(), owner_id: user.id, name: clean, created_at: t, updated_at: t };
    await put("folders", row);
    const { owner_id: _owner, ...folder } = row;
    return { ...folder, design_count: 0 };
  },

  async renameFolder(id, name) {
    const row = await owned<FolderRow>("folders", id);
    const clean = name.trim();
    if (clean.length < 1 || clean.length > 100) throw new ValidationError("A folder name needs 1–100 characters.");
    const next = { ...row, name: clean, updated_at: now() };
    await put("folders", next);
    const { owner_id: _owner, ...folder } = next;
    return { ...folder, design_count: 0 };
  },

  async deleteFolder(id) {
    const row = await owned<FolderRow>("folders", id);
    // same as the schema: its designs go back to the Projects root
    for (const d of await all<DesignRow>("designs")) {
      if (d.folder_id === id && d.owner_id === row.owner_id) await put("designs", { ...d, folder_id: null });
    }
    await remove("folders", id);
  },

  async uploadAsset(file, size, id) {
    await wait();
    const user = await me();
    if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) throw new ValidationError("Use a PNG, JPG or WebP image.");
    if (file.size > UPLOAD_MAX_BYTES) throw new ValidationError("That image is over 25 MB.");
    if (size.width_px > 8000 || size.height_px > 8000) throw new ValidationError("That image is over 8000 px on one side.");
    const used = (await all<AssetRow>("assets")).filter((a) => a.owner_id === user.id).reduce((n, a) => n + a.size_bytes, 0);
    if (used + file.size > USER_QUOTA_BYTES) throw new ValidationError("You've used your 200 MB of uploads.");
    const row: AssetRow = {
      id: id ?? crypto.randomUUID(),
      owner_id: user.id,
      original_name: file.name.slice(0, 255),
      mime: file.type,
      size_bytes: file.size,
      width_px: size.width_px,
      height_px: size.height_px,
      deleted_at: null,
      created_at: now(),
      blob: file,
    };
    await put("assets", row);
    const { owner_id: _owner, blob, ...asset } = row;
    return { ...asset, url: urlFor(`asset:${row.id}`, blob) };
  },

  async listAssets(query = {}) {
    await wait();
    const user = await me();
    return (await all<AssetRow>("assets"))
      .filter((a) => a.owner_id === user.id && (query.in_trash ? a.deleted_at !== null : a.deleted_at === null))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ owner_id: _owner, blob, ...a }) => ({ ...a, url: urlFor(`asset:${a.id}`, blob) }));
  },

  async trashAsset(id) {
    const row = await owned<AssetRow>("assets", id);
    await put("assets", { ...row, deleted_at: now() });
  },

  async restoreAsset(id) {
    const row = await owned<AssetRow>("assets", id);
    await put("assets", { ...row, deleted_at: null });
  },

  async deleteAsset(id) {
    await owned<AssetRow>("assets", id);
    await remove("assets", id);
    dropUrl(`asset:${id}`);
  },
};
