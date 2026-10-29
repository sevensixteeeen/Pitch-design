// Pitch's own templates (S04 Templates screen, S12 the editor's Templates tab). They live in
// templates.json, written by make_templates.py; the backend tests check each one is a valid design.
import { loadFonts } from "../editor/fonts";
import { measureTextHeight } from "../editor/geometry";
import { scaleElement } from "../editor/ops";
import { cloneElement, newId, walk, type DesignContent, type Element, type Page } from "../lib/document";
import raw from "./templates.json";

export type Category = "social_post" | "story" | "presentation" | "poster" | "a4_document";

export interface Template {
  id: string;
  title: string;
  category: Category;
  width_px: number;
  height_px: number;
  content: DesignContent;
}

export const TEMPLATES = raw as Template[];

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "social_post", label: "Social posts" },
  { value: "story", label: "Stories" },
  { value: "presentation", label: "Presentations" },
  { value: "poster", label: "Posters" },
  { value: "a4_document", label: "A4 documents" },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** The fonts a template's text uses (loaded before its preview is drawn or it's used). */
export function templateFonts(t: Template): string[] {
  const fonts = new Set<string>();
  for (const page of t.content.pages) for (const el of walk(page.elements)) if (el.type === "text") fonts.add(el.font_family);
  return [...fonts];
}

/** Text boxes measured with the real font, so their height matches what the canvas draws. */
function measured(el: Element): Element {
  if (el.type === "group") return { ...el, children: el.children.map(measured) };
  return el.type === "text" ? { ...el, height: measureTextHeight(el) } : el;
}

/** A template's pages as new content: fresh ids (a copy, never linked back) and measured text. */
export async function prepare(t: Template): Promise<DesignContent> {
  await loadFonts(templateFonts(t));
  return {
    schema_version: 1,
    pages: t.content.pages.map((p) => ({ ...p, id: newId(), elements: p.elements.map((el) => measured(cloneElement(el))) })),
  };
}

/**
 * A template page made to fit a page of another size: everything shrinks or grows evenly to fit
 * inside, centred (S12, applying a template to the open design).
 */
export function fitPage(page: Page, from: { width: number; height: number }, to: { width: number; height: number }): Page {
  const k = Math.min(to.width / from.width, to.height / from.height);
  const dx = (to.width - from.width * k) / 2;
  const dy = (to.height - from.height * k) / 2;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    ...page,
    // measured again after scaling (fonts are loaded by prepare())
    elements: page.elements.map((el) => measured({ ...scaleElement(el, k), x: round(el.x * k + dx), y: round(el.y * k + dy) })),
  };
}
