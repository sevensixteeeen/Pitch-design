// Editing operations on a page's elements. Pure functions: they return a new
// array and never change the one they're given. Locked elements don't move.
import { cloneElement, newId, type Element, type GroupElement } from "../lib/document";
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
  const copies = els.filter((el) => ids.includes(el.id)).map((el) => ({ ...cloneElement(el), x: pos(el.x + offset), y: pos(el.y + offset) }));
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

/**
 * Puts the selected (unlocked) elements into one group, at the layer of the topmost of them.
 * The group's box is the box around them; their positions become relative to it, so nothing moves.
 * Needs at least two; returns null otherwise.
 */
export function group(els: Element[], ids: string[]): { els: Element[]; id: string } | null {
  const picked = els.filter((el) => ids.includes(el.id) && !el.locked);
  if (picked.length < 2) return null;
  const box = union(picked.map(bounds))!;
  const g: GroupElement = {
    id: newId(),
    type: "group",
    x: round2(box.x),
    y: round2(box.y),
    width: round2(box.width),
    height: round2(box.height),
    rotation: 0,
    opacity: 1,
    locked: false,
    flip_x: false,
    flip_y: false,
    children: picked.map((el) => ({ ...el, x: round2(el.x - box.x), y: round2(el.y - box.y) })),
  };
  const top = Math.max(...picked.map((el) => els.indexOf(el)));
  const out: Element[] = [];
  els.forEach((el, i) => {
    if (!picked.includes(el)) out.push(el);
    if (i === top) out.push(g);
  });
  return { els: out, id: g.id };
}

/**
 * The selected groups' children go back onto the page where they appear now: the group's rotation,
 * flips and opacity are carried over into each child.
 */
export function ungroup(els: Element[], ids: string[]): { els: Element[]; ids: string[] } {
  const freed: string[] = [];
  const out = els.flatMap((el) => {
    if (el.type !== "group" || !ids.includes(el.id) || el.locked) return [el];
    const gcx = el.x + el.width / 2;
    const gcy = el.y + el.height / 2;
    const a = (el.rotation * Math.PI) / 180;
    return el.children.map((child) => {
      // the child's centre, relative to the group's centre, then flipped and turned like the group
      let dx = child.x + child.width / 2 - el.width / 2;
      let dy = child.y + child.height / 2 - el.height / 2;
      let rotation = child.rotation;
      let { flip_x, flip_y } = child;
      if (el.flip_x) {
        dx = -dx;
        flip_x = !flip_x;
        rotation = -rotation;
      }
      if (el.flip_y) {
        dy = -dy;
        flip_y = !flip_y;
        rotation = -rotation;
      }
      const cx = gcx + dx * Math.cos(a) - dy * Math.sin(a);
      const cy = gcy + dx * Math.sin(a) + dy * Math.cos(a);
      freed.push(child.id);
      return {
        ...child,
        x: pos(cx - child.width / 2),
        y: pos(cy - child.height / 2),
        rotation: round2((((rotation + el.rotation) % 360) + 360) % 360),
        flip_x,
        flip_y,
        opacity: round2(child.opacity * el.opacity),
      } as Element;
    });
  });
  return { els: out, ids: freed };
}

/** An element grown or shrunk by `s` around its own top-left; groups scale everything inside them. */
export function scaleElement(el: Element, s: number): Element {
  const size = { width: round2(Math.max(0.01, el.width * s)), height: round2(Math.max(0.01, el.height * s)) };
  const inner = (e: Element) => ({ ...scaleElement(e, s), x: round2(e.x * s), y: round2(e.y * s) });
  switch (el.type) {
    case "group":
      return { ...el, ...size, children: el.children.map(inner) };
    case "text":
      return { ...el, ...size, font_size: round2(Math.min(800, Math.max(1, el.font_size * s))), letter_spacing: round2(el.letter_spacing * s) };
    case "shape":
      return { ...el, ...size, stroke_width: round2(Math.min(1000, el.stroke_width * s)), corner_radius: round2(el.corner_radius * s) };
    case "line":
      return { ...el, ...size, stroke_width: round2(Math.min(1000, Math.max(0.5, el.stroke_width * s))) };
    case "image":
      return { ...el, ...size, corner_radius: round2(el.corner_radius * s) };
  }
}

export function nudge(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const updates: Record<string, Partial<Element>> = {};
  for (const el of els) if (ids.includes(el.id) && !el.locked) updates[el.id] = { x: pos(el.x + dx), y: pos(el.y + dy) };
  return patch(els, updates);
}
