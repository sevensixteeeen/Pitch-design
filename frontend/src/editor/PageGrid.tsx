// S18 Pages grid view: every page as a small picture. Click one to edit it; duplicate, delete or add
// pages; drag a page (or Alt+← / Alt+→ on it) to change the order. Escape goes back to the canvas.
// The canvas stays underneath (hidden), and the pictures are drawn from it.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { MAX_PAGES } from "../lib/document";
import { cn, focusRing } from "../lib/cn";
import { Button, IconButton } from "../components/ui/Button";
import type { ExportPage } from "./Canvas";
import { useEditor, useEditorStore } from "./store";

const THUMB_SIDE = 320; // px, longest side

function closePageGrid(store: ReturnType<typeof useEditorStore>) {
  store.getState().setPageGrid(false);
  // back to the button that opened it
  setTimeout(() => document.querySelector<HTMLElement>("[data-grid-toggle]")?.focus(), 0);
}

export function PageGrid({ exportRef }: { exportRef: RefObject<ExportPage | null> }) {
  const store = useEditorStore();
  const pages = useEditor((s) => s.content.pages);
  const active = useEditor((s) => s.activePage);
  const readOnly = useEditor((s) => s.readOnly);
  const { width_px: w, height_px: h } = useEditor((s) => s.design);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null); // before page i (pages.length = after the last)
  const activeButton = useRef<HTMLButtonElement>(null);
  const n = pages.length;

  // draw the pictures from the canvas once it has the latest content
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const exportPage = exportRef.current;
      if (!exportPage) return;
      const next: Record<string, string> = {};
      pages.forEach((p, i) => {
        try {
          next[p.id] = exportPage(i, "image/png", undefined, THUMB_SIDE);
        } catch {
          // not drawn yet: the box stays plain
        }
      });
      setThumbs(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [pages, exportRef]);

  useEffect(() => {
    activeButton.current?.focus();
    // only when the grid opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (i: number) => {
    store.getState().setActivePage(i);
    closePageGrid(store);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!e.altKey || readOnly) return;
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // the editor would otherwise nudge the selection
    if (i + step >= 0 && i + step < n) store.getState().movePage(i, i + step);
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>, i: number) => {
    if (dragging === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const box = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientX < box.left + box.width / 2 ? i : i + 1);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragging !== null && dropAt !== null) store.getState().movePage(dragging, dropAt > dragging ? dropAt - 1 : dropAt);
    setDragging(null);
    setDropAt(null);
  };

  return (
    <section
      aria-label="All pages"
      className="absolute inset-0 z-20 overflow-auto bg-workspace p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closePageGrid(store);
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">
          All pages ({n}){!readOnly && <span className="ml-2 text-xs font-normal text-muted">Drag to reorder, or Alt+← / Alt+→ on a page</span>}
        </h2>
        <Button size="sm" icon={<X className="size-4" aria-hidden />} onClick={() => closePageGrid(store)}>
          Back to editing
        </Button>
      </div>
      <ol className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pages.map((p, i) => (
          <li
            key={p.id}
            draggable={!readOnly}
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", `Page ${i + 1}`);
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={onDrop}
            onDragEnd={() => {
              setDragging(null);
              setDropAt(null);
            }}
            className={cn("relative", dragging === i && "opacity-50")}
          >
            {dropAt === i && <div aria-hidden className="absolute inset-y-0 -left-3.5 w-1 rounded-full bg-accent" />}
            {dropAt === n && i === n - 1 && <div aria-hidden className="absolute inset-y-0 -right-3.5 w-1 rounded-full bg-accent" />}
            <div className={cn("flex flex-col gap-2 rounded-lg border bg-app p-2", i === active ? "border-accent ring-2 ring-accent" : "border-border")}>
              <button
                ref={i === active ? activeButton : undefined}
                type="button"
                aria-label={`Page ${i + 1}`}
                aria-current={i === active ? "page" : undefined}
                onClick={() => open(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn("flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-surface p-2", focusRing)}
              >
                {thumbs[p.id] ? (
                  <img src={thumbs[p.id]} alt="" className="max-h-full max-w-full object-contain shadow-card" />
                ) : (
                  <div aria-hidden className="max-h-full max-w-full bg-app" style={{ aspectRatio: `${w} / ${h}`, height: h >= w ? "100%" : "auto", width: w > h ? "100%" : "auto" }} />
                )}
              </button>
              <div className="flex items-center gap-1 px-1">
                <span className="mr-auto text-sm">Page {i + 1}</span>
                {!readOnly && (
                  <>
                    <IconButton label={`Duplicate page ${i + 1}`} size="sm" disabled={n >= MAX_PAGES} onClick={() => store.getState().duplicatePage(i)}>
                      <Copy strokeWidth={1.75} aria-hidden />
                    </IconButton>
                    <IconButton label={n <= 1 ? "A design needs at least one page" : `Delete page ${i + 1}`} size="sm" disabled={n <= 1} onClick={() => store.getState().deletePage(i)}>
                      <Trash2 strokeWidth={1.75} aria-hidden />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
        {!readOnly && (
          <li>
            <button
              type="button"
              disabled={n >= MAX_PAGES}
              onClick={() => store.getState().addPage(n - 1)}
              className={cn(
                "flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted hover:border-fg hover:text-fg disabled:opacity-50",
                focusRing,
              )}
            >
              <Plus className="size-6" aria-hidden />
              Add a page
            </button>
          </li>
        )}
      </ol>
    </section>
  );
}
