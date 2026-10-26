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

export interface EditorState {
  design: Design;
  content: DesignContent;
  revision: number;
  /** asset id -> link; images without one draw as "missing image" */
  assetUrls: Record<string, string>;
  selectedId: string | null;
  /** bumps on every change; autosave saves when it's ahead of what was saved */
  edits: number;
  save: SaveState;
  /** last change, for screen readers ("Added a heading") */
  announcement: string;
  readOnly: boolean;

  addElement(el: Element, announcement: string): void;
  moveElement(id: string, x: number, y: number): void;
  select(id: string | null): void;
  addAssetUrl(id: string, url: string): void;
  setRevision(revision: number): void;
  setSave(save: SaveState): void;
}

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(design: Design, assetUrls: Record<string, string>): EditorStore {
  // milestone 1 edits the first page only; adding pages comes in milestone 2
  const updateFirstPage = (content: DesignContent, change: (elements: Element[]) => Element[]): DesignContent => ({
    ...content,
    pages: content.pages.map((page, i) => (i === 0 ? { ...page, elements: change(page.elements) } : page)),
  });

  return createStore<EditorState>((set) => ({
    design,
    content: design.content,
    revision: design.revision,
    assetUrls,
    selectedId: null,
    edits: 0,
    save: { kind: "saved" },
    announcement: "",
    readOnly: design.deleted_at !== null,

    addElement: (el, announcement) =>
      set((s) =>
        s.readOnly
          ? s
          : {
              content: updateFirstPage(s.content, (els) => [...els, el]), // last = on top
              selectedId: el.id,
              edits: s.edits + 1,
              announcement,
            },
      ),
    moveElement: (id, x, y) =>
      set((s) =>
        s.readOnly
          ? s
          : {
              content: updateFirstPage(s.content, (els) => els.map((el) => (el.id === id ? { ...el, x, y } : el))),
              edits: s.edits + 1,
            },
      ),
    select: (selectedId) => set({ selectedId }),
    addAssetUrl: (id, url) => set((s) => ({ assetUrls: { ...s.assetUrls, [id]: url } })),
    setRevision: (revision) => set({ revision }),
    setSave: (save) => set({ save }),
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
