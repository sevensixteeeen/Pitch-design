// The editor's state: one store per open editor, so leaving one design and
// opening another can never mix their contents or revisions.
import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { Design } from "../data";
import type { DesignContent, Element } from "../lib/document";

export type SaveState =
  | { kind: "saved" }
  | { kind: "saving" }
  | { kind: "retrying" } // network or server trouble; keeps trying
  | { kind: "conflict" } // saved from another tab since this one loaded
  | { kind: "gone" } // deleted or moved to Trash somewhere else
  | { kind: "signed-out" }
  | { kind: "refused"; message: string }; // the server won't take this content

/** How the page is shown: "fit" follows the window; a number is a fixed zoom (1 = 100 %). */
export type Zoom = "fit" | number;
export interface View {
  scale: number; // what is on screen now
  fit: number; // the scale that fits the window
  min: number;
  max: number;
}

const HISTORY_MAX = 100; // undo steps kept (browser only, cleared on reload)

export interface EditorState {
  design: Design;
  content: DesignContent;
  revision: number;
  /** asset id -> link; images without one draw as "missing image" */
  assetUrls: Record<string, string>;
  selectedIds: string[];
  /** bumps on every change; autosave saves when it's ahead of what was saved */
  edits: number;
  save: SaveState;
  /** last change, for screen readers ("Added a heading") */
  announcement: string;
  readOnly: boolean;
  past: DesignContent[];
  future: DesignContent[];
  /** content before the current slider drag or held arrow key: one undo step for the whole gesture */
  gestureStart: DesignContent | null;
  zoom: Zoom;
  view: View;

  /**
   * Change the first page's elements (milestone 2b adds pages). One undo step, unless `gesture` is
   * set: then every change until endGesture() is a single step.
   */
  change(fn: (els: Element[]) => Element[], opts?: { gesture?: boolean; select?: string[]; announcement?: string }): void;
  endGesture(): void;
  addElement(el: Element, announcement: string): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  addAssetUrl(id: string, url: string): void;
  setRevision(revision: number): void;
  setSave(save: SaveState): void;
  setZoom(zoom: Zoom): void;
  setView(view: View): void;
}

export type EditorStore = StoreApi<EditorState>;

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** The next zoom step up or down from the current scale, within the allowed range. */
export function stepZoom(view: View, direction: 1 | -1): number {
  const steps = ZOOM_STEPS.filter((z) => z >= view.min && z <= view.max);
  const next = direction > 0 ? steps.find((z) => z > view.scale + 0.001) : [...steps].reverse().find((z) => z < view.scale - 0.001);
  return next ?? (direction > 0 ? view.max : view.min);
}

export function createEditorStore(design: Design, assetUrls: Record<string, string>): EditorStore {
  const updateFirstPage = (content: DesignContent, fn: (els: Element[]) => Element[]): DesignContent => ({
    ...content,
    pages: content.pages.map((page, i) => (i === 0 ? { ...page, elements: fn(page.elements) } : page)),
  });
  const push = (list: DesignContent[], item: DesignContent) => [...list, item].slice(-HISTORY_MAX);
  const existing = (ids: string[], content: DesignContent) => {
    const have = new Set(content.pages.flatMap((p) => p.elements.map((el) => el.id)));
    return ids.filter((id) => have.has(id));
  };

  return createStore<EditorState>((set, get) => ({
    design,
    content: design.content,
    revision: design.revision,
    assetUrls,
    selectedIds: [],
    edits: 0,
    save: { kind: "saved" },
    announcement: "",
    readOnly: design.deleted_at !== null,
    past: [],
    future: [],
    gestureStart: null,
    zoom: "fit",
    view: { scale: 1, fit: 1, min: 0.1, max: 4 },

    change: (fn, opts = {}) =>
      set((s) => {
        if (s.readOnly) return s;
        const content = updateFirstPage(s.content, fn);
        return {
          content,
          ...(opts.gesture
            ? { gestureStart: s.gestureStart ?? s.content }
            : { past: push(s.past, s.gestureStart ?? s.content), gestureStart: null }),
          future: [],
          edits: s.edits + 1,
          ...(opts.select && { selectedIds: opts.select }),
          ...(opts.announcement && { announcement: opts.announcement }),
        };
      }),
    endGesture: () => set((s) => (s.gestureStart ? { past: push(s.past, s.gestureStart), gestureStart: null } : s)),
    addElement: (el, announcement) => get().change((els) => [...els, el], { select: [el.id], announcement }),
    undo: () =>
      set((s) => {
        if (s.readOnly || s.past.length === 0) return s;
        const content = s.past[s.past.length - 1];
        return {
          content,
          past: s.past.slice(0, -1),
          future: [s.content, ...s.future].slice(0, HISTORY_MAX),
          gestureStart: null,
          edits: s.edits + 1,
          selectedIds: existing(s.selectedIds, content),
          announcement: "Undone",
        };
      }),
    redo: () =>
      set((s) => {
        if (s.readOnly || s.future.length === 0) return s;
        const [content, ...future] = s.future;
        return {
          content,
          past: push(s.past, s.content),
          future,
          gestureStart: null,
          edits: s.edits + 1,
          selectedIds: existing(s.selectedIds, content),
          announcement: "Redone",
        };
      }),
    select: (selectedIds) => set({ selectedIds }),
    toggleSelect: (id) =>
      set((s) => ({ selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] })),
    addAssetUrl: (id, url) => set((s) => ({ assetUrls: { ...s.assetUrls, [id]: url } })),
    setRevision: (revision) => set({ revision }),
    setSave: (save) => set({ save }),
    setZoom: (zoom) => set((s) => ({ zoom: zoom === "fit" ? "fit" : Math.min(s.view.max, Math.max(s.view.min, zoom)) })),
    setView: (view) =>
      set((s) =>
        s.view.scale === view.scale && s.view.fit === view.fit && s.view.min === view.min && s.view.max === view.max ? s : { view },
      ),
  }));
}

export const EditorContext = createContext<EditorStore | null>(null);

export function useEditorStore(): EditorStore {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditor needs <EditorContext.Provider>");
  return store;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}
