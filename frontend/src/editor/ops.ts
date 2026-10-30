// Editing operations on a page's elements. Pure functions: they return a new
// array and never change the one they're given. Locked elements don't move.
import { cloneElement, newId, type Element, type GroupElement, type ImageElement } from "../lib/document";
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
    case "text": {
      // effects grow with the text (limits as in app/document.py)
      const shadow = el.shadow && {
        ...el.shadow,
        blur: round2(Math.min(200, el.shadow.blur * s)),
        offset_x: round2(Math.max(-1000, Math.min(1000, el.shadow.offset_x * s))),
        offset_y: round2(Math.max(-1000, Math.min(1000, el.shadow.offset_y * s))),
      };
      const outline = el.outline && { ...el.outline, width: round2(Math.min(100, Math.max(0.01, el.outline.width * s))) };
      return {
        ...el,
        ...size,
        font_size: round2(Math.min(800, Math.max(1, el.font_size * s))),
        letter_spacing: round2(el.letter_spacing * s),
        ...(el.shadow !== undefined && { shadow }),
        ...(el.outline !== undefined && { outline }),
      };
    }
    case "shape":
      return { ...el, ...size, stroke_width: round2(Math.min(1000, el.stroke_width * s)), corner_radius: round2(el.corner_radius * s) };
    case "line":
      return { ...el, ...size, stroke_width: round2(Math.min(1000, Math.max(0.5, el.stroke_width * s))) };
    case "image":
      return { ...el, ...size, corner_radius: round2(el.corner_radius * s) };
  }
}

/** Flips the selected (unlocked) elements; a flip is drawn around the element's own centre. */
export function flip(els: Element[], ids: string[], axis: "x" | "y"): Element[] {
  const updates: Record<string, Partial<Element>> = {};
  for (const el of els) {
    if (!ids.includes(el.id) || el.locked) continue;
    updates[el.id] = axis === "x" ? { flip_x: !el.flip_x } : { flip_y: !el.flip_y };
  }
  return patch(els, updates);
}

export function setLocked(els: Element[], ids: string[], locked: boolean): Element[] {
  const updates: Record<string, Partial<Element>> = {};
  for (const el of els) if (ids.includes(el.id)) updates[el.id] = { locked };
  return patch(els, updates);
}

/** Moves one element to position `index` in the drawing order (0 = at the back). */
export function moveTo(els: Element[], id: string, index: number): Element[] {
  const from = els.findIndex((el) => el.id === id);
  if (from < 0) return els;
  const out = els.filter((el) => el.id !== id);
  out.splice(Math.max(0, Math.min(out.length, index)), 0, els[from]);
  return out;
}

export interface Geometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

const SIZE_MAX = 100_000; // same limit as the server

/**
 * Typed position, size or rotation for one element (the Position panel). Photos and groups keep
 * their proportions (a typed width sets the height too, and the other way round); a text box's
 * height follows its text and a line's height is its thickness, so only their width changes.
 * `measure` gives a text box's height at a width (geometry.ts measureTextHeight).
 */
/** A text box narrower than one wide letter can't show any letter, so its text vanished (BUG-019). */
export const minTextWidth = (fontSize: number) => Math.ceil(fontSize);

export function setGeometry(el: Element, g: Geometry, measure: (el: Element & { type: "text" }) => number): Element {
  let next: Element = { ...el };
  if (g.x !== undefined) next.x = pos(g.x);
  if (g.y !== undefined) next.y = pos(g.y);
  if (g.rotation !== undefined) next.rotation = round2(((g.rotation % 360) + 360) % 360);
  const size = (v: number) => round2(Math.min(SIZE_MAX, Math.max(1, v)));
  if (g.width !== undefined || g.height !== undefined) {
    if (el.type === "group" || el.type === "image") {
      const factor = g.width !== undefined ? size(g.width) / el.width : size(g.height!) / el.height;
      const scaled = scaleElement(el, factor);
      next = { ...scaled, x: next.x, y: next.y, rotation: next.rotation };
    } else if (el.type === "text") {
      if (g.width !== undefined) {
        const width = Math.max(size(g.width), minTextWidth(el.font_size));
        next = { ...next, width, height: measure({ ...(next as typeof el), width }) } as Element;
      }
    } else if (el.type === "line") {
      if (g.width !== undefined) next.width = size(g.width);
    } else {
      if (g.width !== undefined) next.width = size(g.width);
      if (g.height !== undefined) next.height = size(g.height);
    }
  }
  return next;
}

export function nudge(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const updates: Record<string, Partial<Element>> = {};
  for (const el of els) if (ids.includes(el.id) && !el.locked) updates[el.id] = { x: pos(el.x + dx), y: pos(el.y + dy) };
  return patch(els, updates);
}

// --- S17 crop: the frame is drawn in the photo element's own (unrotated, unflipped) box -----------

/** The whole photo, in the element's own box: where it is when the visible part fills the box. */
export function wholePhotoBox(el: ImageElement): Box {
  const c = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const width = el.width / c.width;
  const height = el.height / c.height;
  return { x: -c.x * width, y: -c.y * height, width, height };
}

/**
 * The element after cropping to `frame` (in its own box): the frame becomes the new box, at the same
 * place on the page (also when rotated or flipped), and the crop says which part of the photo shows.
 * A frame over the whole photo removes the crop.
 */
export function applyCrop(el: ImageElement, frame: Box): Partial<ImageElement> {
  const photo = wholePhotoBox(el);
  const clampTo = (v: number) => Math.min(1, Math.max(0, v));
  const crop = {
    x: clampTo((frame.x - photo.x) / photo.width),
    y: clampTo((frame.y - photo.y) / photo.height),
    width: clampTo(frame.width / photo.width),
    height: clampTo(frame.height / photo.height),
  };
  crop.width = Math.min(crop.width, 1 - crop.x);
  crop.height = Math.min(crop.height, 1 - crop.y);
  const whole = crop.x < 0.0005 && crop.y < 0.0005 && crop.width > 0.9995 && crop.height > 0.9995;
  // the frame's centre, from the box's centre, turned the way the element is flipped and rotated
  let dx = frame.x + frame.width / 2 - el.width / 2;
  let dy = frame.y + frame.height / 2 - el.height / 2;
  if (el.flip_x) dx = -dx;
  if (el.flip_y) dy = -dy;
  const a = (el.rotation * Math.PI) / 180;
  const cx = el.x + el.width / 2 + dx * Math.cos(a) - dy * Math.sin(a);
  const cy = el.y + el.height / 2 + dx * Math.sin(a) + dy * Math.cos(a);
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    x: pos(cx - frame.width / 2),
    y: pos(cy - frame.height / 2),
    width: round2(frame.width),
    height: round2(frame.height),
    crop: whole ? null : { x: r6(crop.x), y: r6(crop.y), width: r6(crop.width), height: r6(crop.height) },
  };
}

/** A frame moved or resized by hand, kept on the photo and at least `min` px each way. */
export function keepFrameOnPhoto(frame: Box, photo: Box, min = 8): Box {
  const width = Math.min(photo.width, Math.max(min, frame.width));
  const height = Math.min(photo.height, Math.max(min, frame.height));
  const x = Math.min(photo.x + photo.width - width, Math.max(photo.x, frame.x));
  const y = Math.min(photo.y + photo.height - height, Math.max(photo.y, frame.y));
  return { x, y, width, height };
}
