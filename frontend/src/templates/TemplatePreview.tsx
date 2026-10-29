// A template's first page, drawn small with the editor's own drawing code. Waits for the template's
// fonts first (the canvas doesn't redraw when a font arrives late). Outside the editor it brings its
// own (empty) editor store, which the drawing code reads photo links from.
import { useContext, useEffect, useState } from "react";
import type { Design } from "../data";
import { PagePreview } from "../editor/Canvas";
import { loadFonts } from "../editor/fonts";
import { createEditorStore, EditorContext, type EditorStore } from "../editor/store";
import { blankContent } from "../lib/document";
import { templateFonts, type Template } from ".";

let previewStore: EditorStore | null = null;
function ownStore(): EditorStore {
  const t = new Date(0).toISOString();
  const design: Design = {
    id: "template-preview",
    title: "",
    width_px: 100,
    height_px: 100,
    display_unit: "px",
    folder_id: null,
    page_count: 1,
    revision: 1,
    thumbnail_url: null,
    deleted_at: null,
    created_at: t,
    updated_at: t,
    content: blankContent(),
  };
  previewStore ??= createEditorStore(design, {});
  return previewStore;
}

/** The preview is as big as fits in `box` (px), keeping the template's proportions. */
export function TemplatePreview({ template, box }: { template: Template; box: { width: number; height: number } }) {
  const editor = useContext(EditorContext);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadFonts(templateFonts(template)).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [template]);

  const { width_px: w, height_px: h } = template;
  if (!ready) {
    // a box with the template's proportions until the fonts are ready
    const k = Math.min(box.width / w, box.height / h);
    return <div aria-hidden className="bg-surface-hover" style={{ width: Math.round(w * k), height: Math.round(h * k) }} />;
  }
  const preview = <PagePreview page={template.content.pages[0]} width={w} height={h} box={box} />;
  return <div aria-hidden>{editor ? preview : <EditorContext.Provider value={ownStore()}>{preview}</EditorContext.Provider>}</div>;
}
