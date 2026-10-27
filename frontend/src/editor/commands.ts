// Commands on the current selection, shared by the toolbar, the menus and the keyboard.
import type { Element } from "../lib/document";
import { align, duplicate, nudge, patch, remove, reorder, type AlignEdge, type LayerMove } from "./ops";
import type { EditorStore } from "./store";

const firstPage = (store: EditorStore) => store.getState().content.pages[0].elements;

export function describeElement(el: Element): string {
  if (el.type === "text") return `Text: ${el.text}`;
  if (el.type === "image") return "Image";
  return el.kind === "ellipse" ? "Ellipse" : "Rectangle";
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
