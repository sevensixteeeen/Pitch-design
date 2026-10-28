// The design document stored in designs.content (see replica/architecture.md).
// Hand-written for now; once the FastAPI backend exists these types are
// generated from its OpenAPI file (src/api/types.ts) and this file goes away.
// Field names are snake_case because that is what the API sends.

export type Hex = string; // "#RRGGBB"

interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  locked: boolean;
  flip_x: boolean;
  flip_y: boolean;
  name?: string;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  font_family: string;
  font_size: number;
  color: Hex;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right" | "justify";
  letter_spacing: number;
  line_height: number;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  kind: "rect" | "ellipse" | "triangle";
  fill: Hex;
  stroke: Hex | null;
  stroke_width: number;
  corner_radius: number;
}

export interface ImageElement extends ElementBase {
  type: "image";
  src: { kind: "asset"; asset_id: string };
  corner_radius: number;
}

/** A straight line across the middle of its box; width = length, height = thickness. */
export interface LineElement extends ElementBase {
  type: "line";
  stroke: Hex;
  stroke_width: number;
  dash: "solid" | "dashed" | "dotted";
  arrow_start: boolean;
  arrow_end: boolean;
}

/** Elements that move as one. Children's x / y are relative to the group's top-left corner. */
export interface GroupElement extends ElementBase {
  type: "group";
  children: Element[];
}

export type Element = TextElement | ShapeElement | ImageElement | LineElement | GroupElement;

/** Every element including those inside groups, depth first. */
export function* walk(elements: Element[]): Generator<Element> {
  for (const el of elements) {
    yield el;
    if (el.type === "group") yield* walk(el.children);
  }
}

export const MAX_PAGES = 200;

export interface Page {
  id: string;
  background: { color: Hex };
  elements: Element[]; // last = on top
}

export interface DesignContent {
  schema_version: 1;
  pages: Page[];
}

export type DisplayUnit = "px" | "in" | "mm" | "cm";

export const SIZE_MIN = 40;
export const SIZE_MAX = 8000;
export const AREA_MAX = 25_000_000;
export const PX_PER_UNIT: Record<DisplayUnit, number> = { px: 1, in: 96, mm: 96 / 25.4, cm: 96 / 2.54 };

/** Error text for a width/height in px, or null when it is allowed. Same rules as schema.sql. */
export function sizeError(widthPx: number, heightPx: number): string | null {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) return "Enter a width and a height.";
  if (widthPx < SIZE_MIN || heightPx < SIZE_MIN || widthPx > SIZE_MAX || heightPx > SIZE_MAX) {
    return `Each side must be ${SIZE_MIN}–${SIZE_MAX} px.`;
  }
  if (widthPx * heightPx > AREA_MAX) return "That's too large. Width × height can be at most 25 million px.";
  return null;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function blankContent(background: Hex = "#ffffff"): DesignContent {
  return { schema_version: 1, pages: [{ id: newId(), background: { color: background }, elements: [] }] };
}

const base = (x: number, y: number, width: number, height: number): ElementBase => ({
  id: newId(),
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  locked: false,
  flip_x: false,
  flip_y: false,
});

export function makeText(
  pageW: number,
  pageH: number,
  preset: "heading" | "subheading" | "body",
): TextElement {
  const size = { heading: 0.08, subheading: 0.05, body: 0.032 }[preset] * Math.min(pageW, pageH);
  const fontSize = Math.max(8, Math.round(size));
  const width = Math.round(pageW * 0.7);
  const height = Math.round(fontSize * 1.3);
  return {
    ...base(Math.round((pageW - width) / 2), Math.round((pageH - height) / 2), width, height),
    type: "text",
    text: { heading: "Add a heading", subheading: "Add a subheading", body: "Add some body text" }[preset],
    font_family: "Inter Variable",
    font_size: fontSize,
    color: "#15181d",
    bold: preset !== "body",
    italic: false,
    underline: false,
    align: "center",
    letter_spacing: 0,
    line_height: 1.3,
  };
}

export function makeShape(pageW: number, pageH: number, kind: ShapeElement["kind"]): ShapeElement {
  const side = Math.round(Math.min(pageW, pageH) * 0.3);
  return {
    ...base(Math.round((pageW - side) / 2), Math.round((pageH - side) / 2), side, side),
    type: "shape",
    kind,
    fill: "#9aa3ad",
    stroke: null,
    stroke_width: 0,
    corner_radius: 0,
  };
}

export function makeImage(pageW: number, pageH: number, assetId: string, imgW: number, imgH: number): ImageElement {
  // fit inside 60 % of the page, keep the photo's proportions
  const scale = Math.min((pageW * 0.6) / imgW, (pageH * 0.6) / imgH, 1);
  const width = Math.max(1, Math.round(imgW * scale));
  const height = Math.max(1, Math.round(imgH * scale));
  return {
    ...base(Math.round((pageW - width) / 2), Math.round((pageH - height) / 2), width, height),
    type: "image",
    src: { kind: "asset", asset_id: assetId },
    corner_radius: 0,
  };
}

export function makeLine(pageW: number, pageH: number, arrow: boolean): LineElement {
  const width = Math.round(Math.min(pageW, pageH) * 0.4);
  const thickness = Math.max(2, Math.round(Math.min(pageW, pageH) / 200));
  return {
    ...base(Math.round((pageW - width) / 2), Math.round((pageH - thickness) / 2), width, thickness),
    type: "line",
    stroke: "#15181d",
    stroke_width: thickness,
    dash: "solid",
    arrow_start: false,
    arrow_end: arrow,
  };
}

/** A copy with new ids, also for everything inside groups (two elements must never share an id). */
export function cloneElement(el: Element): Element {
  return el.type === "group" ? { ...el, id: newId(), children: el.children.map(cloneElement) } : { ...el, id: newId() };
}

export function blankPage(background: Hex = "#ffffff"): Page {
  return { id: newId(), background: { color: background }, elements: [] };
}

/** Every asset id used anywhere in the document, inside groups too. */
export function assetIds(content: DesignContent): string[] {
  const ids = new Set<string>();
  for (const page of content.pages) {
    for (const el of walk(page.elements)) if (el.type === "image") ids.add(el.src.asset_id);
  }
  return [...ids];
}
