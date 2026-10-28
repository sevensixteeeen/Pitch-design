// What every screen calls. One function per route in replica/architecture.md
// (Supabase Auth calls included). Two implementations:
//   fake.ts  - this browser's IndexedDB, used until /replica-backend
//   http.ts  - the FastAPI backend (later); same signatures, so no screen changes
import type { DesignContent, DisplayUnit } from "../lib/document";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
}

export interface DesignSummary {
  id: string;
  title: string;
  width_px: number;
  height_px: number;
  display_unit: DisplayUnit;
  folder_id: string | null;
  page_count: number;
  revision: number;
  thumbnail_url: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Design extends DesignSummary {
  content: DesignContent;
}

export interface Asset {
  id: string;
  original_name: string | null;
  mime: string;
  size_bytes: number;
  width_px: number;
  height_px: number;
  url: string; // signed URL (real) or object URL (fake)
  deleted_at: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  design_count: number;
  created_at: string;
  updated_at: string;
}

export type NewDesign = {
  id?: string;
  title?: string;
  width_px: number;
  height_px: number;
  display_unit: DisplayUnit;
};

export interface ListDesignsQuery {
  folder_id?: string;
  in_trash?: boolean;
  q?: string;
  sort?: "updated" | "title";
}

/** The design changed somewhere else (another tab). HTTP 409. */
export class ConflictError extends Error {
  constructor() {
    super("This design was changed in another tab.");
    this.name = "ConflictError";
  }
}

/** Missing, or not yours. HTTP 404 (the API never says which). */
export class NotFoundError extends Error {
  constructor() {
    super("Not found.");
    this.name = "NotFoundError";
  }
}

/** The login expired or was revoked. HTTP 401. */
export class SignedOutError extends Error {
  constructor() {
    super("Please log in again.");
    this.name = "SignedOutError";
  }
}

/** Input the server refuses (size, file type, quota). HTTP 422. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const USER_QUOTA_BYTES = 200 * 1024 * 1024;

export interface DataLayer {
  // auth (Supabase Auth in the browser, later)
  getUser(): Promise<User | null>;
  signUp(email: string, password: string): Promise<User>;
  logIn(email: string, password: string): Promise<User>;
  logOut(): Promise<void>;
  /** Emails a link that opens /reset-password. Never says whether the account exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** For the logged-in user (the email link logs them in first). */
  setNewPassword(password: string): Promise<void>;

  // designs
  listDesigns(query?: ListDesignsQuery): Promise<DesignSummary[]>;
  createDesign(input: NewDesign): Promise<Design>;
  getDesign(id: string): Promise<{ design: Design; asset_urls: Record<string, string> }>;
  saveContent(id: string, content: DesignContent, revision: number): Promise<{ revision: number; updated_at: string }>;
  updateDesign(id: string, patch: { title?: string; folder_id?: string | null }): Promise<DesignSummary>;
  trashDesign(id: string): Promise<void>;
  restoreDesign(id: string): Promise<void>;
  deleteDesign(id: string): Promise<void>;
  uploadThumbnail(id: string, png: Blob): Promise<void>;

  // folders
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  // uploads (the real layer makes two calls: start + complete)
  uploadAsset(file: File, size: { width_px: number; height_px: number }, id?: string): Promise<Asset>;
  listAssets(query?: { in_trash?: boolean }): Promise<Asset[]>;
  trashAsset(id: string): Promise<void>;
  restoreAsset(id: string): Promise<void>;
  deleteAsset(id: string): Promise<void>;
}
