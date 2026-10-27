// Editing operations on a page's elements. Pure functions: they return a new
// array and never change the one they're given. Locked elements don't move.
import { newId, type Element } from "../lib/document";
import { bounds, round2, union, type Box } from "./geometry";

export type LayerMove = "forward" | "backward" | "front" | "back";
export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

const POS_MAX = 100_000; // same limit as the server (app/document.py)
const pos = (v: number) => round2(Math.min(POS_MAX, Math.max(-POS_MAX, v)));

export function patch(els: Element[], updates: Record<string, Partial<Element>>): Element[] {
  return els.map((el) => (updates[el.id] ? ({ ...el, ...updates[el.id] } as Element) : el));
}

export function remove(els: Element[], ids: string[]): Element[] {
  return els.filter((el) => !ids.includes(el.id));
}

/** Copies of the selection, a little down and to the right, on top of everything. */
export function duplicate(els: Element[], ids: string[], offset = 20): { els: Element[]; ids: string[] } {
  const copies = els.filter((el) => ids.includes(el.id)).map((el) => ({ ...el, id: newId(), x: pos(el.x + offset), y: pos(el.y + offset) }));
  return { els: [...els, ...copies], ids: copies.map((c) => c.id) };
}

/** Layer order: the last element is drawn on top. */
export function reorder(els: Element[], ids: string[], move: LayerMove): Element[] {
  const picked = (el: Element) => ids.includes(el.id);
  if (move === "front") return [...els.filter((el) => !picked(el)), ...els.filter(picked)];
  if (move === "back") return [...els.filter(picked), ...els.filter((el) => !picked(el))];
  const out = [...els];
  if (move === "forward") {
    for (let i = out.length - 2; i >= 0; i--) {
      if (picked(out[i]) && !picked(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (picked(out[i]) && !picked(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]];
    }
  }
  return out;
}

/** One element aligns to the page; several align to the box around all of them. */
export function align(els: Element[], ids: string[], edge: AlignEdge, page: Box): Element[] {
  const chosen = els.filter((el) => ids.includes(el.id) && !el.locked);
  const target = chosen.length > 1 ? union(chosen.map(bounds)) : page;
  if (!target || chosen.length === 0) return els;
  const updates: Record<string, Partial<Element>> = {};
  for (const el of chosen) {
    const b = bounds(el);
    const dx = { left: target.x - b.x, center: target.x + target.width / 2 - (b.x + b.width / 2), right: target.x + target.width - (b.x + b.width) };
    const dy = { top: target.y - b.y, middle: target.y + target.height / 2 - (b.y + b.height / 2), bottom: target.y + target.height - (b.y + b.height) };
    if (edge in dx) updates[el.id] = { x: pos(el.x + dx[edge as keyof typeof dx]) };
    else updates[el.id] = { y: pos(el.y + dy[edge as keyof typeof dy]) };
  }
  return patch(els, updates);
}

export function nudge(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const updates: Record<string, Partial<Element>> = {};
  for (const el of els) if (ids.includes(el.id) && !el.locked) updates[el.id] = { x: pos(el.x + dx), y: pos(el.y + dy) };
  return patch(els, updates);
}
