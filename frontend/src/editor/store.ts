// The editor's state: one store per open editor, so leaving one design and
// opening another can never mix their contents or revisions.
import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { Design } from "../data";
import { blankPage, cloneElement, MAX_PAGES, newId, type DesignContent, type Element, type Page } from "../lib/document";

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
  /** the text element being typed into on the canvas, if any */
  editingId: string | null;
  /** the page being edited (index into content.pages); selection is always on this page */
  activePage: number;

  /**
   * Change the active page's elements. One undo step, unless `gesture` is set: then every change
   * until endGesture() is a single step.
   */
  change(fn: (els: Element[]) => Element[], opts?: ChangeOptions): void;
  /** Same, for the active page itself (its background). */
  changePage(fn: (page: Page) => Page, opts?: ChangeOptions): void;
  setEditing(id: string | null): void;
  /** The design's title (saved separately from its content; not part of undo). */
  setTitle(title: string): void;
  /** Saves any unsaved edits now and waits for it. Set by the autosave. */
  flush: () => Promise<void>;
  setActivePage(index: number): void;
  /** A blank page after `index`; it becomes the active page. */
  addPage(index: number): void;
  duplicatePage(index: number): void;
  /** Refused for the last remaining page (the server refuses it too). */
  deletePage(index: number): void;
  endGesture(): void;
  addElement(el: Element, announcement: string): void;
  /** Something to tell screen readers when nothing changed (e.g. "That element is locked"). */
  setAnnouncement(text: string): void;
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
export interface ChangeOptions {
  gesture?: boolean;
  select?: string[];
  announcement?: string;
}

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** The next zoom step up or down from the current scale, within the allowed range. */
export function stepZoom(view: View, direction: 1 | -1): number {
  const steps = ZOOM_STEPS.filter((z) => z >= view.min && z <= view.max);
  const next = direction > 0 ? steps.find((z) => z > view.scale + 0.001) : [...steps].reverse().find((z) => z < view.scale - 0.001);
  return next ?? (direction > 0 ? view.max : view.min);
}

export function createEditorStore(design: Design, assetUrls: Record<string, string>): EditorStore {
  const updatePage = (content: DesignContent, index: number, fn: (page: Page) => Page): DesignContent => ({
    ...content,
    pages: content.pages.map((page, i) => (i === index ? fn(page) : page)),
  });
  /** A whole-document change made in one go (page add / duplicate / delete): one undo step. */
  const commit = (s: EditorState, content: DesignContent, extra: Partial<EditorState>): Partial<EditorState> => ({
    content,
    past: push(s.past, s.gestureStart ?? s.content),
    gestureStart: null,
    future: [],
    edits: s.edits + 1,
    editingId: null,
    ...extra,
  });
  const push = (list: DesignContent[], item: DesignContent) => [...list, item].slice(-HISTORY_MAX);
  /** After undo / redo: stay on a page that still exists and keep only selected elements that are on it. */
  const afterHistory = (s: EditorState, content: DesignContent): Partial<EditorState> => {
    const activePage = Math.min(s.activePage, content.pages.length - 1);
    const have = new Set(content.pages[activePage].elements.map((el) => el.id));
    return { activePage, selectedIds: s.selectedIds.filter((id) => have.has(id)), editingId: null };
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
    editingId: null,
    activePage: 0,

    change: (fn, opts) => get().changePage((page) => ({ ...page, elements: fn(page.elements) }), opts),
    setEditing: (editingId) => set({ editingId }),
    setTitle: (title) => set((s) => ({ design: { ...s.design, title } })),
    flush: async () => {},
    setActivePage: (index) =>
      set((s) => (index === s.activePage || index < 0 || index >= s.content.pages.length ? s : { activePage: index, selectedIds: [], editingId: null })),
    addPage: (index) =>
      set((s) => {
        if (s.readOnly || s.content.pages.length >= MAX_PAGES) return s;
        const pages = [...s.content.pages];
        pages.splice(index + 1, 0, blankPage());
        return commit(s, { ...s.content, pages }, { activePage: index + 1, selectedIds: [], announcement: `Added page ${index + 2}` });
      }),
    duplicatePage: (index) =>
      set((s) => {
        if (s.readOnly || s.content.pages.length >= MAX_PAGES) return s;
        const source = s.content.pages[index];
        const copy: Page = { ...source, id: newId(), elements: source.elements.map(cloneElement) };
        const pages = [...s.content.pages];
        pages.splice(index + 1, 0, copy);
        return commit(s, { ...s.content, pages }, { activePage: index + 1, selectedIds: [], announcement: `Duplicated page ${index + 1}` });
      }),
    deletePage: (index) =>
      set((s) => {
        if (s.readOnly || s.content.pages.length <= 1) return s;
        const pages = s.content.pages.filter((_, i) => i !== index);
        const activePage = Math.min(s.activePage > index ? s.activePage - 1 : s.activePage, pages.length - 1);
        return commit(s, { ...s.content, pages }, { activePage, selectedIds: [], announcement: `Deleted page ${index + 1}` });
      }),
    changePage: (fn, opts = {}) =>
      set((s) => {
        if (s.readOnly) return s;
        const content = updatePage(s.content, s.activePage, fn);
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
          ...afterHistory(s, content),
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
          ...afterHistory(s, content),
          announcement: "Redone",
        };
      }),
    setAnnouncement: (announcement) => set({ announcement }),
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

/** The active page and its elements. */
export const activePage = (s: EditorState) => s.content.pages[s.activePage];
export const activeElements = (s: EditorState) => s.content.pages[s.activePage].elements;
