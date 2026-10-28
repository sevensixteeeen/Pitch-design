// Commands on the current selection, shared by the toolbar, the menus and the keyboard.
import { walk, type DesignContent, type Element, type Hex, type LineElement, type ShapeElement, type TextElement } from "../lib/document";
import { loadFonts } from "./fonts";
import { keepTopLeft, measureTextHeight, round2 } from "./geometry";
import { align, duplicate, group, nudge, patch, remove, reorder, ungroup, type AlignEdge, type LayerMove } from "./ops";
import { activeElements, type EditorStore } from "./store";

const firstPage = (store: EditorStore) => activeElements(store.getState());

export function describeElement(el: Element): string {
  switch (el.type) {
    case "text":
      return `Text: ${el.text}`;
    case "image":
      return "Image";
    case "line":
      return el.arrow_start || el.arrow_end ? "Arrow" : "Line";
    case "group":
      return `Group of ${el.children.length}`;
    case "shape":
      return { rect: "Rectangle", ellipse: "Ellipse", triangle: "Triangle" }[el.kind];
  }
}

export function groupSelection(store: EditorStore) {
  const s = store.getState();
  // needs two or more unlocked elements (the Group button is disabled otherwise)
  const result = group(firstPage(store), s.selectedIds);
  if (result) s.change(() => result.els, { select: [result.id], announcement: "Grouped" });
}

export function ungroupSelection(store: EditorStore) {
  const s = store.getState();
  if (!firstPage(store).some((el) => el.type === "group" && s.selectedIds.includes(el.id))) return;
  const result = ungroup(firstPage(store), s.selectedIds);
  s.change(() => result.els, { select: result.ids, announcement: "Ungrouped" });
}

/** Colour, thickness, dashes and arrow ends for every selected line. A thicker line keeps its middle in place. */
export function styleLines(store: EditorStore, change: Partial<LineElement>, opts: { gesture?: boolean } = {}) {
  const s = store.getState();
  const updates: Record<string, Partial<Element>> = {};
  for (const el of firstPage(store)) {
    if (el.type !== "line" || !s.selectedIds.includes(el.id)) continue;
    const next: Partial<LineElement> = { ...change };
    if (next.stroke_width !== undefined) {
      const w = round2(Math.min(200, Math.max(0.5, next.stroke_width)));
      Object.assign(next, { stroke_width: w, height: w, y: round2(el.y + el.height / 2 - w / 2) });
    }
    updates[el.id] = next;
  }
  if (Object.keys(updates).length) s.change((els) => patch(els, updates), { gesture: opts.gesture });
}

export function deleteSelection(store: EditorStore) {
  const s = store.getState();
  if (s.selectedIds.length === 0) return;
  const n = s.selectedIds.length;
  s.change((els) => remove(els, s.selectedIds), { select: [], announcement: n === 1 ? "Deleted 1 element" : `Deleted ${n} elements` });
}

export function duplicateSelection(store: EditorStore) {
  const s = store.getState();
  if (s.selectedIds.length === 0) return;
  const result = duplicate(firstPage(store), s.selectedIds);
  s.change(() => result.els, { select: result.ids, announcement: "Duplicated" });
}

export function moveLayers(store: EditorStore, move: LayerMove) {
  const s = store.getState();
  if (s.selectedIds.length === 0) return;
  const words = { forward: "Moved forward", backward: "Moved backward", front: "Moved to the front", back: "Moved to the back" };
  s.change((els) => reorder(els, s.selectedIds, move), { announcement: words[move] });
}

export function alignSelection(store: EditorStore, edge: AlignEdge) {
  const s = store.getState();
  if (s.selectedIds.length === 0) return;
  const page = { x: 0, y: 0, width: s.design.width_px, height: s.design.height_px };
  s.change((els) => align(els, s.selectedIds, edge, page), { announcement: `Aligned ${edge}` });
}

/** Arrow keys: one undo step per key hold (the key handler ends the gesture on key up). */
export function nudgeSelection(store: EditorStore, dx: number, dy: number) {
  const s = store.getState();
  if (s.selectedIds.length === 0) return;
  s.change((els) => nudge(els, s.selectedIds, dx, dy), { gesture: true });
}

/** Opacity slider: live while dragging, one undo step when let go (endGesture). */
export function setOpacity(store: EditorStore, opacity: number) {
  const s = store.getState();
  const updates: Record<string, Partial<Element>> = {};
  for (const id of s.selectedIds) updates[id] = { opacity: Math.min(1, Math.max(0, opacity)) };
  s.change((els) => patch(els, updates), { gesture: true });
}

export function selectAll(store: EditorStore) {
  store.getState().select(firstPage(store).map((el) => el.id));
}

/** A text element with new settings, its height re-measured and its top-left corner kept in place. */
function restyle(el: TextElement, change: Partial<TextElement>): Partial<TextElement> {
  const next = { ...el, ...change };
  const height = measureTextHeight(next);
  const { x, y } = keepTopLeft(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, next.width, height, el.rotation);
  return { ...change, x, y, height };
}

/**
 * Text settings for every selected text element (font, size, colour, B/I/U, alignment, spacing).
 * Waits for a new font to load first, so the height is measured with the real font.
 */
export async function styleText(
  store: EditorStore,
  change: Partial<TextElement> | ((el: TextElement) => Partial<TextElement>),
  opts: { gesture?: boolean } = {},
) {
  if (typeof change !== "function" && change.font_family) await loadFonts([change.font_family]);
  const s = store.getState();
  const updates: Record<string, Partial<Element>> = {};
  for (const el of firstPage(store)) {
    if (el.type === "text" && s.selectedIds.includes(el.id)) updates[el.id] = restyle(el, typeof change === "function" ? change(el) : change);
  }
  if (Object.keys(updates).length) s.change((els) => patch(els, updates), { gesture: opts.gesture });
}

/** Finish typing on the canvas: one undo step. A text box left empty is removed. */
export function commitText(store: EditorStore, id: string, text: string) {
  const s = store.getState();
  const el = firstPage(store).find((x): x is TextElement => x.id === id && x.type === "text");
  s.setEditing(null);
  if (!el) return;
  if (text.trim() === "") {
    s.change((els) => remove(els, [id]), { select: [], announcement: "Removed the empty text box" });
  } else if (text !== el.text) {
    const update = restyle(el, { text: text.slice(0, 10_000) });
    s.change((els) => patch(els, { [id]: update }), { announcement: "Text updated" });
  }
}

/** Fill, outline and outline width for every selected shape. */
export function styleShapes(store: EditorStore, change: Partial<ShapeElement>, opts: { gesture?: boolean } = {}) {
  const s = store.getState();
  const updates: Record<string, Partial<Element>> = {};
  for (const el of firstPage(store)) {
    if (el.type === "shape" && s.selectedIds.includes(el.id)) {
      const next = { ...change };
      // adding an outline to a shape that had none: give it a width you can see
      if (next.stroke && el.stroke === null && el.stroke_width === 0 && next.stroke_width === undefined) next.stroke_width = 4;
      if (next.stroke_width !== undefined) next.stroke_width = round2(Math.min(1000, Math.max(0, next.stroke_width)));
      updates[el.id] = next;
    }
  }
  if (Object.keys(updates).length) s.change((els) => patch(els, updates), { gesture: opts.gesture });
}

export function setBackground(store: EditorStore, color: Hex, opts: { gesture?: boolean } = {}) {
  store.getState().changePage((page) => ({ ...page, background: { color } }), { gesture: opts.gesture });
}

/** Colours already used in the design, for the top row of the colour picker (most used first). */
export function documentColours(content: DesignContent, max = 10): Hex[] {
  const count = new Map<string, number>();
  const add = (c: string | null | undefined) => {
    if (c && /^#[0-9a-f]{6}$/i.test(c)) count.set(c.toLowerCase(), (count.get(c.toLowerCase()) ?? 0) + 1);
  };
  for (const page of content.pages) {
    add(page.background.color);
    for (const el of walk(page.elements)) {
      if (el.type === "text") add(el.color);
      if (el.type === "line") add(el.stroke);
      if (el.type === "shape") {
        add(el.fill);
        add(el.stroke);
      }
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, max);
}
