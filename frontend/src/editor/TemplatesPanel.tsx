// S12 the editor's Templates tab: put one of Pitch's templates on the open design. It's resized to fit
// the design's size (evenly, centred). On an empty page it's applied straight away; otherwise it asks
// whether to replace the page or add the template as a new page. One undo step either way.
import { useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { Spinner, toast } from "../components/ui/feedback";
import { Dialog } from "../components/ui/overlays";
import { cn, focusRing } from "../lib/cn";
import { MAX_PAGES } from "../lib/document";
import { categoryLabel, fitPage, prepare, TEMPLATES, type Template } from "../templates";
import { TemplatePreview } from "../templates/TemplatePreview";
import { activePage, useEditor, useEditorStore, type EditorStore } from "./store";

async function pageFrom(store: EditorStore, t: Template) {
  const { width_px, height_px } = store.getState().design;
  const content = await prepare(t);
  return fitPage(content.pages[0], { width: t.width_px, height: t.height_px }, { width: width_px, height: height_px });
}

async function replacePage(store: EditorStore, t: Template) {
  const page = await pageFrom(store, t);
  store.getState().changePage((p) => ({ ...p, background: page.background, elements: page.elements }), { select: [], announcement: `Used the template "${t.title}"` });
}

async function addAsPage(store: EditorStore, t: Template) {
  const page = await pageFrom(store, t);
  const s = store.getState();
  s.addPage(s.activePage, page, `Added the template "${t.title}" as page ${s.activePage + 2}`);
}

export function TemplatesPanel() {
  const store = useEditorStore();
  const readOnly = useEditor((s) => s.readOnly);
  const empty = useEditor((s) => activePage(s).elements.length === 0);
  const pageNumber = useEditor((s) => s.activePage + 1);
  const full = useEditor((s) => s.content.pages.length >= MAX_PAGES);
  const [asking, setAsking] = useState<Template | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const run = async (t: Template, action: (store: EditorStore, t: Template) => Promise<void>) => {
    setBusy(t.id);
    try {
      await action(store, t);
    } catch {
      toast("Couldn't use that template. Try again.", { kind: "error" });
    } finally {
      setBusy(null);
    }
  };

  const pick = (t: Template, button: HTMLElement) => {
    if (empty) return void run(t, replacePage);
    opener.current = button;
    setAsking(t);
  };

  const close = () => {
    setAsking(null);
    setTimeout(() => opener.current?.isConnected && opener.current.focus(), 0);
  };

  return (
    <>
      <h2 className="mb-1 text-base font-semibold">Templates</h2>
      <p className="mb-3 text-xs text-muted">Resized to fit your design. You can undo it.</p>
      <ul className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={readOnly || busy !== null}
              aria-busy={busy === t.id || undefined}
              aria-label={`Use the template ${t.title} (${categoryLabel(t.category)})`}
              title={t.title}
              onClick={(e) => pick(t, e.currentTarget)}
              className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface p-2 hover:bg-surface-hover disabled:opacity-60", focusRing)}
            >
              <span className="shadow-card">
                <TemplatePreview template={t} box={{ width: 120, height: 120 }} />
              </span>
              {busy === t.id && (
                <span className="absolute inset-0 flex items-center justify-center bg-app/70">
                  <Spinner className="size-5" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {asking && (
        <Dialog open onOpenChange={(o) => !o && close()} title={`Use "${asking.title}"?`} description={`Page ${pageNumber} already has things on it.`}>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              disabled={full}
              onClick={() => {
                const t = asking;
                close();
                void run(t, addAsPage);
              }}
            >
              Add as a new page
            </Button>
            <Button
              onClick={() => {
                const t = asking;
                close();
                void run(t, replacePage);
              }}
            >
              Replace page {pageNumber}
            </Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
