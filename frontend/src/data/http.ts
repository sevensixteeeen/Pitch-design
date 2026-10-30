// Real data layer: Supabase Auth for logging in, the FastAPI backend (/api)
// for everything else. Same functions and errors as fake.ts, so screens
// don't know which one they talk to.
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  ConflictError,
  NotFoundError,
  SignedOutError,
  UnreachableError,
  UPLOAD_TYPES,
  ValidationError,
  type Asset,
  type DataLayer,
  type Design,
  type DesignSummary,
  type Folder,
  type User,
} from "./api";

interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
}

async function accessToken(): Promise<string> {
  // refreshes the token first if it is about to expire
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new SignedOutError();
  return data.session.access_token;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new UnreachableError();
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  const detail: unknown = await res
    .json()
    .then((b: { detail?: unknown }) => b.detail)
    .catch(() => null);
  const message = typeof detail === "string" ? detail : null;
  switch (res.status) {
    case 401:
      throw new SignedOutError();
    case 404:
      throw new NotFoundError();
    case 409:
      throw new ConflictError();
    case 413:
    case 422:
      throw new ValidationError(message ?? "Some of that isn't allowed.");
    case 429:
      throw new Error(message ?? "Too many requests. Wait a moment and try again.");
    case 502:
    case 503:
    case 504:
      // the dev server's answer when the API server isn't running (BUG-010)
      throw new UnreachableError();
    default:
      throw new Error("Something went wrong on our side. Try again.");
  }
}

function query(params: Record<string, string | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Supabase's error codes, in the same words fake.ts uses. */
function authMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent you.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Log in instead.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many tries. Wait a few minutes and try again.";
    case "same_password":
      return "That's your current password. Pick a new one.";
    case "weak_password":
      return "Use at least 8 characters for your password.";
    default:
      return error.message;
  }
}

async function uploadTo(target: SignedUpload, file: Blob, contentType: string): Promise<void> {
  const { error } = await supabase()
    .storage.from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, file, { contentType, upsert: true });
  if (error) throw new Error("The upload didn't finish. Try again.");
}

export const http: DataLayer = {
  async getUser() {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return null;
    try {
      return await call<User>("GET", "/me");
    } catch (err) {
      if (!(err instanceof SignedOutError)) throw err;
      await supabase().auth.signOut({ scope: "local" });
      return null;
    }
  },

  async signUp(email, password) {
    if (password.length < 8) throw new ValidationError("Use at least 8 characters for your password.");
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new ValidationError(authMessage(error));
    // "Confirm email" is on: no session until the link in the email is opened
    if (!data.session) throw new ValidationError("Check your inbox: open the link we sent you, then log in.");
    return call<User>("GET", "/me");
  },

  async logIn(email, password) {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new ValidationError(authMessage(error));
    return call<User>("GET", "/me");
  },

  async logOut() {
    // "global" ends the session on every device, not only this browser
    await supabase().auth.signOut({ scope: "global" });
  },

  async requestPasswordReset(email) {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new ValidationError(authMessage(error));
  },

  async setNewPassword(password) {
    if (password.length < 8) throw new ValidationError("Use at least 8 characters for your password.");
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw new ValidationError(authMessage(error));
  },

  async changePassword(current, next) {
    if (next.length < 8) throw new ValidationError("Use at least 8 characters for your new password.");
    const { data } = await supabase().auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new SignedOutError();
    // Supabase changes a password without asking for the old one, so check it by logging in with it
    const check = await supabase().auth.signInWithPassword({ email, password: current });
    if (check.error) {
      throw new ValidationError(check.error.code === "invalid_credentials" ? "Your current password isn't right." : authMessage(check.error));
    }
    const { error } = await supabase().auth.updateUser({ password: next });
    if (error) throw new ValidationError(authMessage(error));
  },

  listDesigns(q = {}) {
    return call<DesignSummary[]>(
      "GET",
      `/designs${query({ folder_id: q.folder_id, in_trash: q.in_trash, q: q.q?.trim(), sort: q.sort })}`,
    );
  },

  createDesign(input) {
    return call<Design>("POST", "/designs", input);
  },

  getDesign(id) {
    return call<{ design: Design; asset_urls: Record<string, string> }>("GET", `/designs/${id}`);
  },

  saveContent(id, content, revision) {
    return call<{ revision: number; updated_at: string }>("PUT", `/designs/${id}/content`, { content, revision });
  },

  updateDesign(id, patch) {
    return call<DesignSummary>("PATCH", `/designs/${id}`, patch);
  },

  async trashDesign(id) {
    await call<void>("POST", `/designs/${id}/trash`);
  },

  async restoreDesign(id) {
    await call<void>("POST", `/designs/${id}/restore`);
  },

  async deleteDesign(id) {
    await call<void>("DELETE", `/designs/${id}`);
  },

  async uploadThumbnail(id, png) {
    await uploadTo(await call<SignedUpload>("POST", `/designs/${id}/thumbnail`), png, "image/png");
  },

  listFolders() {
    return call<Folder[]>("GET", "/folders");
  },

  createFolder(name) {
    return call<Folder>("POST", "/folders", { name });
  },

  renameFolder(id, name) {
    return call<Folder>("PATCH", `/folders/${id}`, { name });
  },

  async deleteFolder(id) {
    await call<void>("DELETE", `/folders/${id}`);
  },

  async uploadAsset(file, size, id) {
    // the server checks all of this again; checking here saves a round trip
    if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) throw new ValidationError("Use a PNG, JPG or WebP image.");
    const started = await call<{ id: string; upload: SignedUpload | null }>("POST", "/assets", {
      id,
      original_name: file.name.slice(0, 255),
      mime: file.type,
      size_bytes: file.size,
    });
    if (started.upload) await uploadTo(started.upload, file, file.type);
    return call<Asset>("POST", `/assets/${started.id}/complete`, size);
  },

  listAssets(q = {}) {
    return call<Asset[]>("GET", `/assets${query({ in_trash: q.in_trash })}`);
  },

  async trashAsset(id) {
    await call<void>("POST", `/assets/${id}/trash`);
  },

  async restoreAsset(id) {
    await call<void>("POST", `/assets/${id}/restore`);
  },

  async deleteAsset(id) {
    await call<void>("DELETE", `/assets/${id}`);
  },
};
