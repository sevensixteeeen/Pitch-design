// Box maths for the editor. Element x/y is the top-left of the unrotated box;
// rotation turns around the box's centre (see Canvas.tsx).
import Konva from "konva";
import type { Element, TextElement } from "../lib/document";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const round2 = (v: number) => Math.round(v * 100) / 100;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The upright box around an element after its rotation. */
export function bounds(el: Element): Box {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const width = el.width * cos + el.height * sin;
  const height = el.width * sin + el.height * cos;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

export function union(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function fontStyle(el: Pick<TextElement, "bold" | "italic">) {
  if (el.bold && el.italic) return "italic bold";
  if (el.bold) return "bold";
  return el.italic ? "italic" : "normal";
}

/** Height of a text box at its width, measured the way the canvas draws it. */
export function measureTextHeight(el: TextElement): number {
  const node = new Konva.Text({
    text: el.text,
    width: el.width,
    fontFamily: el.font_family,
    fontSize: el.font_size,
    fontStyle: fontStyle(el),
    letterSpacing: el.letter_spacing,
    lineHeight: el.line_height,
  });
  const height = node.height();
  node.destroy();
  return Math.max(1, round2(height));
}

/**
 * New x/y for a box that changes size but keeps its top-left corner where it is on the page, also
 * when rotated. (cx, cy) is the box's current centre; rotation turns around the centre.
 * Used when text re-wraps: the box grows or shrinks downward instead of jumping.
 */
export function keepTopLeft(cx: number, cy: number, oldW: number, oldH: number, newW: number, newH: number, rotation: number) {
  const a = (rotation * Math.PI) / 180;
  const turn = (dx: number, dy: number) => ({ x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) });
  const corner = turn(-oldW / 2, -oldH / 2);
  const toCentre = turn(newW / 2, newH / 2);
  const x = cx + corner.x + toCentre.x - newW / 2;
  const y = cy + corner.y + toCentre.y - newH / 2;
  return { x: round2(x), y: round2(y) };
}

/** A gap to mark on the canvas while spacing snaps: a segment from (x1, y1) to (x2, y2). */
export interface Gap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Equal spacing along one axis. Neighbours are boxes that overlap the moving box on the other axis.
 * Two cases snap: the moving box sits between two neighbours with (almost) equal gaps, or it repeats
 * the gap between the two neighbours next to it on one side. Returns the move to apply and the gaps
 * to mark, or null.
 */
function spacingOnAxis(m: Box, others: Box[], threshold: number, axis: "x" | "y"): { delta: number; gaps: Gap[] } | null {
  // work in "start / size" terms so one function handles both axes
  const s = (b: Box) => (axis === "x" ? b.x : b.y);
  const len = (b: Box) => (axis === "x" ? b.width : b.height);
  const cs = (b: Box) => (axis === "x" ? b.y : b.x); // cross-axis start
  const clen = (b: Box) => (axis === "x" ? b.height : b.width);
  const overlaps = (a: Box, b: Box) => cs(a) < cs(b) + clen(b) && cs(b) < cs(a) + clen(a);
  const end = (b: Box) => s(b) + len(b);
  const row = others.filter((b) => overlaps(b, m));
  const before = row.filter((b) => end(b) <= s(m) + threshold).sort((a, b) => end(b) - end(a));
  const after = row.filter((b) => s(b) >= end(m) - threshold).sort((a, b) => s(a) - s(b));
  // where to draw a gap marker: the middle of the overlap with the moving box, across the axis
  const mid = (a: Box, b: Box) => (Math.max(cs(a), cs(b)) + Math.min(cs(a) + clen(a), cs(b) + clen(b))) / 2;
  const gap = (from: number, to: number, at: number): Gap => (axis === "x" ? { x1: from, y1: at, x2: to, y2: at } : { x1: at, y1: from, x2: at, y2: to });

  const options: { delta: number; gaps: (pos: number) => Gap[] }[] = [];
  const [L, LL] = before;
  const [R, RR] = after;
  if (L && R) {
    const target = (end(L) + s(R) - len(m)) / 2; // centred between them
    options.push({ delta: target - s(m), gaps: (p) => [gap(end(L), p, mid(L, m)), gap(p + len(m), s(R), mid(R, m))] });
  }
  if (L && LL && overlaps(L, LL) && end(LL) <= s(L)) {
    const target = end(L) + (s(L) - end(LL)); // repeat the gap on the left
    options.push({ delta: target - s(m), gaps: (p) => [gap(end(LL), s(L), mid(LL, L)), gap(end(L), p, mid(L, m))] });
  }
  if (R && RR && overlaps(R, RR) && s(RR) >= end(R)) {
    const target = s(R) - (s(RR) - end(R)) - len(m); // repeat the gap on the right
    options.push({ delta: target - s(m), gaps: (p) => [gap(p + len(m), s(R), mid(R, m)), gap(end(R), s(RR), mid(R, RR))] });
  }
  const best = options.filter((o) => Math.abs(o.delta) <= threshold).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
  return best ? { delta: best.delta, gaps: best.gaps(s(m) + best.delta) } : null;
}

export function spacingSnap(m: Box, others: Box[], threshold: number) {
  return { x: spacingOnAxis(m, others, threshold, "x"), y: spacingOnAxis(m, others, threshold, "y") };
}

/** Lines a resize handle can snap to: page edges and centre, and other elements' edges and centres. */
export function snapTargets(others: Box[], page: Box) {
  const xs = [page.x, page.x + page.width / 2, page.x + page.width];
  const ys = [page.y, page.y + page.height / 2, page.y + page.height];
  for (const b of others) {
    xs.push(b.x, b.x + b.width / 2, b.x + b.width);
    ys.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  return { xs, ys };
}

/** The nearest target within `threshold` of `v`, or null. */
export function nearest(v: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const t of targets) if (Math.abs(t - v) <= threshold && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t;
  return best;
}

/** Snapping: the closest page or element line within `threshold` of the moving box's edges or centre. */
export interface Snap {
  dx: number;
  dy: number;
  vertical: number[]; // x positions of guides to draw
  horizontal: number[]; // y positions of guides to draw
}

export function snapBox(moving: Box, others: Box[], page: Box, threshold: number): Snap {
  const xs = [page.x, page.x + page.width / 2, page.x + page.width];
  const ys = [page.y, page.y + page.height / 2, page.y + page.height];
  for (const b of others) {
    xs.push(b.x, b.x + b.width / 2, b.x + b.width);
    ys.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  const best = (edges: number[], targets: number[]) => {
    let pick: { delta: number; at: number } | null = null;
    for (const e of edges) {
      for (const t of targets) {
        const d = t - e;
        if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.delta))) pick = { delta: d, at: t };
      }
    }
    return pick;
  };
  const sx = best([moving.x, moving.x + moving.width / 2, moving.x + moving.width], xs);
  const sy = best([moving.y, moving.y + moving.height / 2, moving.y + moving.height], ys);
  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    vertical: sx ? [sx.at] : [],
    horizontal: sy ? [sy.at] : [],
  };
}
