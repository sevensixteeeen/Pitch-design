// S08 editor page: loads the design, then shows TopBar + SidePanel + Canvas.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router";
import { RotateCw } from "lucide-react";
import { api, NotFoundError } from "../data";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton, toast } from "../components/ui/feedback";
import { NotFound } from "../pages/stubs";
import { Canvas, type ExportPng } from "./Canvas";
import { SidePanel } from "./SidePanel";
import { SmallScreenNote, TopBar } from "./TopBar";
import { EditorContext, createEditorStore, useEditor, type EditorStore } from "./store";
import { useAutosave } from "./useAutosave";

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

/** Text is measured when drawn, so wait for the font first (or lines break in the wrong place). */
async function fontsReady() {
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([
    Promise.all([document.fonts.load('400 16px "Inter Variable"'), document.fonts.load('700 16px "Inter Variable"')]),
    timeout,
  ]);
}

type Load = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; store: EditorStore };

export function EditorPage() {
  const { designId = "" } = useParams();
  const wide = useWideEnough();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const open = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const [{ design, asset_urls }] = await Promise.all([api.getDesign(designId), fontsReady()]);
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
  const exportRef = useRef<ExportPng | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const designId = useEditor((s) => s.design.id);

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
        <main className="flex min-w-0 flex-1 flex-col" aria-label="Page">
          <Canvas exportRef={exportRef} />
          <ElementList />
        </main>
      </div>
    </div>
  );
}

/** What's on the page, for screen readers (the canvas itself is a picture to them). */
function ElementList() {
  const elements = useEditor((s) => s.content.pages[0].elements);
  const announcement = useEditor((s) => s.announcement);
  const describe = (el: (typeof elements)[number]) =>
    el.type === "text" ? `Text: ${el.text}` : el.type === "image" ? "Image" : el.kind === "ellipse" ? "Ellipse" : "Rectangle";
  return (
    <div className="sr-only">
      <h2>On this page</h2>
      {elements.length === 0 ? (
        <p>Nothing yet. Add text, a rectangle or an image from the panel.</p>
      ) : (
        <ul>
          {elements.map((el) => (
            <li key={el.id}>{describe(el)}</li>
          ))}
        </ul>
      )}
      <p aria-live="polite">{announcement}</p>
    </div>
  );
}
