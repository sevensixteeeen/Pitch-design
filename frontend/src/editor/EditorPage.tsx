// S08 editor page: loads the design, then shows TopBar + SidePanel + Canvas.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router";
import { RotateCw } from "lucide-react";
import { api, NotFoundError } from "../data";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton, toast } from "../components/ui/feedback";
import { NotFound } from "../pages/stubs";
import { cn, focusRing } from "../lib/cn";
import { walk } from "../lib/document";
import { BottomBar } from "./BottomBar";
import { Canvas, type ExportPage } from "./Canvas";
import { describeElement } from "./commands";
import { loadFonts } from "./fonts";
import { ContextToolbar } from "./ContextToolbar";
import { PageGrid } from "./PageGrid";
import { SidePanel } from "./SidePanel";
import { SmallScreenNote, TopBar } from "./TopBar";
import { EditorContext, activeElements, createEditorStore, useEditor, useEditorStore, type EditorStore } from "./store";
import { useAutosave } from "./useAutosave";
import { useEditorKeys } from "./useEditorKeys";
import { useThumbnail } from "./useThumbnail";

/** True when the window is at least layout.editor-min-w wide. */
function useWideEnough() {
  const query = useState(() => {
    const min = getComputedStyle(document.documentElement).getPropertyValue("--tk-layout-editor-min-w").trim() || "1024px";
    return window.matchMedia(`(min-width: ${min})`);
  })[0];
  return useSyncExternalStore(
    (onChange) => {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => query.matches,
  );
}

type Load = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; store: EditorStore };

export function EditorPage() {
  const { designId = "" } = useParams();
  const wide = useWideEnough();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const open = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const { design, asset_urls } = await api.getDesign(designId);
      // text is measured when it's drawn, so its fonts must be ready first (or lines break in the wrong
      // place); Inter too, the font for new text
      const families = design.content.pages.flatMap((p) => [...walk(p.elements)].flatMap((el) => (el.type === "text" ? [el.font_family] : [])));
      await loadFonts(["Inter Variable", ...families]);
      setLoad({ kind: "ready", store: createEditorStore(design, asset_urls) });
    } catch (err) {
      setLoad({ kind: err instanceof NotFoundError ? "missing" : "failed" });
    }
  }, [designId]);

  useEffect(() => {
    void open();
  }, [open]);

  if (!wide) return <SmallScreenNote />;
  if (load.kind === "missing") return <NotFound />;
  if (load.kind === "failed") {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={<RotateCw />} title="Couldn't open this design" body="Check your connection and try again." action={<Button onClick={open}>Try again</Button>} />
      </div>
    );
  }
  if (load.kind === "loading") {
    return (
      <div className="flex h-full flex-col" aria-busy="true">
        <div className="h-(--tk-layout-topbar-h) border-b border-border bg-app" />
        <div className="flex flex-1 items-center justify-center bg-workspace">
          <Skeleton className="aspect-4/5 h-2/3" />
          <span className="sr-only">Opening your design</span>
        </div>
      </div>
    );
  }
  return (
    <EditorContext.Provider value={load.store}>
      <Editor store={load.store} onRestored={open} />
    </EditorContext.Provider>
  );
}

function Editor({ store, onRestored }: { store: EditorStore; onRestored: () => void }) {
  useAutosave(store);
  useEditorKeys(store);
  const exportRef = useRef<ExportPage | null>(null);
  useThumbnail(store, exportRef);
  const readOnly = useEditor((s) => s.readOnly);
  const designId = useEditor((s) => s.design.id);
  const pageGrid = useEditor((s) => s.pageGrid);

  const restore = async () => {
    try {
      await api.restoreDesign(designId);
      onRestored();
    } catch {
      toast("Couldn't restore it. Try again.", { kind: "error" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar exportRef={exportRef} />
      {readOnly && (
        <div role="status" className="flex items-center justify-center gap-3 border-b border-border bg-surface px-4 py-2 text-sm">
          This design is in Trash. Restore it to keep editing.
          <Button size="sm" onClick={restore}>
            Restore
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <SidePanel />
        <main className="relative flex min-w-0 flex-1 flex-col" aria-label="Page">
          {!pageGrid && <ContextToolbar />}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* under the grid the canvas stays (its pages draw the grid's pictures) but can't be reached */}
            <div className="flex min-h-0 flex-1 flex-col" inert={pageGrid}>
              <Canvas exportRef={exportRef} />
            </div>
            {pageGrid && <PageGrid exportRef={exportRef} />}
          </div>
          <BottomBar />
          <ElementList />
        </main>
      </div>
    </div>
  );
}

/**
 * What's on the page, top layer first. The canvas is a picture to screen readers and the keyboard,
 * so this list is their way in (components.md, Canvas a11y): it stays hidden until it gets focus,
 * Enter selects (Shift+Enter adds), then arrow keys move and Delete removes.
 */
function ElementList() {
  const store = useEditorStore();
  const elements = useEditor(activeElements);
  const pageNumber = useEditor((s) => s.activePage + 1);
  const selectedIds = useEditor((s) => s.selectedIds);
  const announcement = useEditor((s) => s.announcement);
  return (
    <>
      <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-12 focus-within:left-3 focus-within:z-10 focus-within:max-h-64 focus-within:w-72 focus-within:overflow-y-auto focus-within:rounded-lg focus-within:border focus-within:border-border focus-within:bg-app focus-within:p-2 focus-within:shadow-pop">
        <h2 className="px-2 pb-1 text-xs font-semibold">On page {pageNumber}, top first</h2>
        {elements.length === 0 ? (
          <p className="px-2 text-sm text-muted">Nothing yet. Add text, a rectangle or an image from the panel.</p>
        ) : (
          <ul>
            {[...elements].reverse().map((el) => {
              const selected = selectedIds.includes(el.id);
              return (
                <li key={el.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={(e) => (e.shiftKey ? store.getState().toggleSelect(el.id) : store.getState().select([el.id]))}
                    className={cn("w-full truncate rounded-sm px-2 py-1 text-left text-sm hover:bg-surface-hover", selected && "bg-accent-soft text-accent", focusRing)}
                  >
                    {describeElement(el)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
