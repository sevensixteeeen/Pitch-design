// The small picture of a design on Home and Projects: page 1 as a PNG, made in the browser and uploaded
// with the link POST /api/designs/{id}/thumbnail hands out (architecture.md).
// - made after each successful save, once the photos on page 1 have loaded
// - uploaded after a few quiet seconds, so a burst of edits uploads once; leaving the editor uploads
//   any picture still waiting
// - a design opened without a thumbnail (or whose upload never landed) gets one straight away
// - an edit made less than ~1 s before leaving is saved after the canvas is gone, so the picture
//   misses it until the next save
// It's a nice-to-have: a failed upload is kept and tried again later; it never bothers the user.
import { useEffect, type RefObject } from "react";
import { api } from "../data";
import { assetIds } from "../lib/document";
import type { ExportPage } from "./Canvas";
import type { EditorStore } from "./store";

const MAX_SIDE = 400; // px, longest side: sharp on a high-density screen at card size
const UPLOAD_AFTER_MS = 3000;
const DRAW_MS = 500; // after the photos load, time for the canvas to draw them

/** Resolves once the browser has the image (or gave up on it); the canvas uses the same cached copy. */
function loaded(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

export function useThumbnail(store: EditorStore, exportRef: RefObject<ExportPage | null>) {
  useEffect(() => {
    let waiting: Blob | null = null;
    let timer: number | undefined;
    let latest = 0; // a newer request makes older ones stop
    const designId = store.getState().design.id;

    const upload = () => {
      window.clearTimeout(timer);
      const png = waiting;
      if (!png) return;
      waiting = null;
      api.uploadThumbnail(designId, png).catch(() => {
        waiting ??= png; // try again with the next one
      });
    };

    const make = async () => {
      const run = ++latest;
      const s = store.getState();
      if (s.readOnly) return;
      const firstPage = { ...s.content, pages: s.content.pages.slice(0, 1) };
      const urls = assetIds(firstPage).flatMap((id) => (s.assetUrls[id] ? [s.assetUrls[id]] : []));
      if (urls.length > 0) {
        await Promise.all(urls.map(loaded));
        await new Promise((resolve) => setTimeout(resolve, DRAW_MS));
      }
      const exportPage = exportRef.current;
      if (run !== latest || !exportPage) return;
      try {
        waiting = await (await fetch(exportPage(0, "image/png", undefined, MAX_SIDE))).blob();
      } catch {
        return; // the page isn't on screen yet; the next save tries again
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(upload, UPLOAD_AFTER_MS);
    };

    // the revision changes only when a save went through
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.revision !== prev.revision) void make();
    });
    if (!store.getState().design.thumbnail_url) void make();

    return () => {
      unsubscribe();
      latest += 1; // drop a picture still being made: the canvas is going away
      upload();
    };
  }, [store, exportRef]);
}
