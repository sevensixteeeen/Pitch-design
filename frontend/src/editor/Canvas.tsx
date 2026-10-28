// S08 canvas (Konva). Every page is drawn on its own stage, stacked vertically with a label and page
// actions above it (components.md, Canvas + Page). One page is active: selecting, moving, resizing,
// rotating, snapping and typing happen there. Clicking another page makes it active.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Label, Layer, Line, Rect, Stage, Tag, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { Copy, Plus, Trash2 } from "lucide-react";
import { MAX_PAGES, type Element, type ImageElement, type LineElement, type TextElement } from "../lib/document";
import { cn } from "../lib/cn";
import { IconButton } from "../components/ui/Button";
import { commitText } from "./commands";
import { TextEditor } from "./TextEditor";
import {
  bounds,
  clamp,
  fontStyle,
  intersects,
  keepTopLeft,
  measureTextHeight,
  nearest,
  round2,
  snapBox,
  snapTargets,
  spacingSnap,
  union,
  type Box,
  type Gap,
} from "./geometry";
import { nudge, patch, scaleElement } from "./ops";
import { activeElements, useEditor, useEditorStore } from "./store";

const SNAP_SCREEN_PX = 5; // components.md, SmartGuides
const MAX_STAGE_PX = 12_000; // keep each page's canvas within what browsers can draw
const STAGE_MARGIN_PX = 40; // room around each page for the selection handles (screen px)
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const SIDES_X = ["middle-left", "middle-right"];
const ALL_ANCHORS = [...CORNERS, ...SIDES_X, "top-center", "bottom-center"];
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Canvas colours and spacing come from the design tokens (components.md, ground rules). */
function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    selection: v("--tk-color-selection"),
    guide: v("--tk-color-guide"),
    onGuide: v("--tk-color-on-inverse"), // distance labels: text on the guide colour
    handleFill: v("--tk-color-bg"),
    placeholderFill: v("--tk-color-surface-hover"),
    placeholderLine: v("--tk-color-border-input"),
    placeholderText: v("--tk-color-text-muted"),
    pad: parseFloat(v("--tk-space-8")) || 0, // room around the pages
    gap: parseFloat(v("--tk-space-7")) || 0, // between pages
    labelH: parseFloat(v("--tk-space-7")) || 0, // the page label row
  };
}
type Colours = ReturnType<typeof tokens>;

/** Draws one page (0-based) as an image at the design's real size; returns a data URL. Set by <Canvas>. */
export type ExportPage = (page: number, type: "image/png" | "image/jpeg", quality?: number) => string;

function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Loads an image for the canvas. crossOrigin keeps PNG export working with images from Storage. */
function useImage(url: string | undefined) {
  const [state, setState] = useState<{ img: HTMLImageElement | null; failed: boolean }>({ img: null, failed: false });
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setState({ img, failed: false });
    img.onerror = () => setState({ img: null, failed: true });
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);
  return url ? state : { img: null, failed: true };
}

function ImageNode({ el, url, colours }: { el: ImageElement; url: string | undefined; colours: Colours }) {
  const { img, failed } = useImage(url);
  if (img) return <KonvaImage image={img} width={el.width} height={el.height} cornerRadius={el.corner_radius} />;
  // no link (deleted, or not yours) or failed to load: a placeholder of the same size
  return (
    <>
      <Rect width={el.width} height={el.height} fill={colours.placeholderFill} stroke={colours.placeholderLine} strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false} />
      {failed && (
        <Text
          text="Image missing"
          width={el.width}
          height={el.height}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(10, Math.min(el.width, el.height) / 8)}
          fill={colours.placeholderText}
        />
      )}
    </>
  );
}

function LineNode({ el }: { el: LineElement }) {
  const w = el.stroke_width;
  const dash = el.dash === "dashed" ? [w * 3, w * 2] : el.dash === "dotted" ? [0.001, w * 2] : undefined;
  return (
    <Arrow
      points={[0, el.height / 2, el.width, el.height / 2]}
      stroke={el.stroke}
      fill={el.stroke}
      strokeWidth={w}
      dash={dash}
      lineCap={el.dash === "dotted" ? "round" : "butt"}
      pointerAtBeginning={el.arrow_start}
      pointerAtEnding={el.arrow_end}
      pointerLength={w * 3 + 4}
      pointerWidth={w * 3 + 4}
      hitStrokeWidth={Math.max(w, 24)} // a thin line is still easy to click
    />
  );
}

/** Where an element sits inside its parent: by its centre, so rotation and flips turn around the middle. */
const placement = (el: Element) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
  offsetX: el.width / 2,
  offsetY: el.height / 2,
  rotation: el.rotation,
  scaleX: el.flip_x ? -1 : 1,
  scaleY: el.flip_y ? -1 : 1,
  opacity: el.opacity,
});

function ElementNode({ el, colours }: { el: Element; colours: Colours }) {
  const url = useEditor((s) => (el.type === "image" ? s.assetUrls[el.src.asset_id] : undefined));
  const editing = useEditor((s) => s.editingId === el.id);
  switch (el.type) {
    case "text":
      return (
        <Text
          visible={!editing} // the text area shows it while it's being typed
          text={el.text}
          width={el.width}
          fontFamily={el.font_family}
          fontSize={el.font_size}
          fontStyle={fontStyle(el)}
          textDecoration={el.underline ? "underline" : ""}
          fill={el.color}
          align={el.align}
          letterSpacing={el.letter_spacing}
          lineHeight={el.line_height}
        />
      );
    case "shape": {
      const paint = { fill: el.fill, stroke: el.stroke ?? undefined, strokeWidth: el.stroke_width };
      if (el.kind === "ellipse") return <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} {...paint} />;
      if (el.kind === "triangle") return <Line points={[el.width / 2, 0, el.width, el.height, 0, el.height]} closed {...paint} />;
      return <Rect width={el.width} height={el.height} cornerRadius={el.corner_radius} {...paint} />;
    }
    case "line":
      return <LineNode el={el} />;
    case "image":
      return <ImageNode el={el} url={url} colours={colours} />;
    case "group":
      // children are placed relative to the group's top-left; clicks bubble up to the group
      return (
        <>
          {el.children.map((child) => (
            <Group key={child.id} {...placement(child)}>
              <ElementNode el={child} colours={colours} />
            </Group>
          ))}
        </>
      );
  }
}

function PageHeader({ index, count, active, readOnly, width, height }: { index: number; count: number; active: boolean; readOnly: boolean; width: number; height: number }) {
  const store = useEditorStore();
  const full = count >= MAX_PAGES;
  return (
    // above its stage's margin, but only the buttons catch the mouse (a selection's rotate handle can sit here)
    <div className="pointer-events-none relative z-10 flex items-center gap-1" style={{ width, height }}>
      <button
        type="button"
        onClick={() => store.getState().setActivePage(index)}
        aria-current={active ? "page" : undefined}
        className={cn("pointer-events-auto mr-auto rounded-sm px-1 text-xs", active ? "font-semibold text-fg" : "text-muted hover:text-fg")}
      >
        Page {index + 1}
      </button>
      {!readOnly && (
        <span className="pointer-events-auto flex items-center gap-1">
          <IconButton label={`Add a page after page ${index + 1}`} size="sm" disabled={full} onClick={() => store.getState().addPage(index)}>
            <Plus strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Duplicate page ${index + 1}`} size="sm" disabled={full} onClick={() => store.getState().duplicatePage(index)}>
            <Copy strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={count <= 1 ? "A design needs at least one page" : `Delete page ${index + 1}`} size="sm" disabled={count <= 1} onClick={() => store.getState().deletePage(index)}>
            <Trash2 strokeWidth={1.75} aria-hidden />
          </IconButton>
        </span>
      )}
    </div>
  );
}

export function Canvas({ exportRef }: { exportRef: RefObject<ExportPage | null> }) {
  const store = useEditorStore();
  const design = useEditor((s) => s.design);
  const pages = useEditor((s) => s.content.pages);
  const active = useEditor((s) => s.activePage);
  const selectedIds = useEditor((s) => s.selectedIds);
  const readOnly = useEditor((s) => s.readOnly);
  const zoom = useEditor((s) => s.zoom);
  const editingId = useEditor((s) => s.editingId);

  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(box);
  const stages = useRef<(Konva.Stage | null)[]>([]);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  const transformer = useRef<Konva.Transformer>(null);
  const [colours] = useState(tokens);
  const [guides, setGuides] = useState<{ v: number[]; h: number[]; gaps: Gap[] }>({ v: [], h: [], gaps: [] });
  const noGuides = { v: [], h: [], gaps: [] };
  /** lines a resize handle can snap to, worked out when a resize starts */
  const resizeTargets = useRef<{ xs: number[]; ys: number[] } | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);

  // --- view: fit one page, or a fixed zoom with scrolling ---------------------------------------
  const pageW = design.width_px;
  const pageH = design.height_px;
  const M = STAGE_MARGIN_PX;
  const fit = width && height ? clamp(Math.min((width - 2 * colours.pad) / pageW, (height - 2 * colours.pad - colours.labelH) / pageH), 0.01, 4) : 0;
  const max = Math.max(fit, Math.min(4, MAX_STAGE_PX / Math.max(pageW, pageH)));
  const min = Math.min(fit, 0.1);
  const scale = zoom === "fit" ? fit : clamp(zoom, min, max);
  const pw = pageW * scale;
  const ph = pageH * scale;

  useEffect(() => {
    if (fit) store.getState().setView({ scale, fit, min, max });
  }, [store, scale, fit, min, max]);

  // after a zoom change, centre the active page
  useLayoutEffect(() => {
    blocks.current[store.getState().activePage]?.scrollIntoView({ block: "center", inline: "center" });
  }, [store, scale]);
  // after a page was added, duplicated or deleted, bring the active page into view
  const pageCount = pages.length;
  useLayoutEffect(() => {
    blocks.current[store.getState().activePage]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [store, pageCount]);

  // Ctrl + wheel zooms (the listener must not be passive to stop the browser's own zoom)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = store.getState();
      s.setZoom(clamp(s.view.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), s.view.min, s.view.max));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [store]);

  const nodeOn = (page: number, id: string) => stages.current[page]?.findOne((n: Konva.Node) => n.id() === id);
  /** The pointer, in the given page's units. */
  const toPage = (page: number) => {
    const p = stages.current[page]?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: (p.x - M) / scale, y: (p.y - M) / scale };
  };
  const focusCanvas = () => box.current?.focus({ preventScroll: true });

  /** Follows the mouse until it is released, even outside the canvas. Positions are in page units. */
  const followPointer = (page: number, onMove: (p: { x: number; y: number }, evt: MouseEvent) => void, onUp: () => void) => {
    const move = (evt: MouseEvent) => {
      stages.current[page]?.setPointersPositions(evt);
      onMove(toPage(page), evt);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      onUp();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // --- selection box with handles (active page only) --------------------------------------------
  const activeEls = pages[active].elements;
  const chosen = readOnly || editingId ? [] : activeEls.filter((el) => selectedIds.includes(el.id) && !el.locked);
  const editing = editingId ? activeEls.find((el): el is TextElement => el.id === editingId && el.type === "text") : undefined;
  const only = chosen.length === 1 ? chosen[0] : null;
  const anchors = !only
    ? CORNERS
    : { text: [...CORNERS, ...SIDES_X], image: CORNERS, group: CORNERS, line: SIDES_X, shape: ALL_ANCHORS }[only.type];
  const keepRatio = !only || (only.type !== "shape" && only.type !== "line");
  const chosenKey = chosen.map((el) => el.id).join(",");

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    tr.nodes(chosen.map((el) => nodeOn(active, el.id)).filter((n): n is Konva.Node => !!n));
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
    // nodes are found by id after each render; the page and scale change their geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey, activeEls, scale, active]);

  // --- snapping while resizing: the dragged handle snaps to page and element lines --------------
  const axisAligned = chosen.every((el) => el.rotation % 360 === 0);
  const onTransformStart = () => {
    const s = store.getState();
    const others = activeElements(s).filter((x) => !s.selectedIds.includes(x.id)).map(bounds);
    resizeTargets.current = snapTargets(others, { x: 0, y: 0, width: pageW, height: pageH });
  };
  const snapAnchor = (pos: { x: number; y: number }, evt?: { altKey?: boolean }) => {
    const anchor = transformer.current?.getActiveAnchor();
    const targets = resizeTargets.current;
    // rotated boxes and the rotate handle don't snap; Alt turns snapping off
    if (!targets || !anchor || anchor === "rotater" || !axisAligned || evt?.altKey) {
      setGuides(noGuides);
      return pos;
    }
    const threshold = SNAP_SCREEN_PX / scale;
    const out = { ...pos };
    const found = { v: [] as number[], h: [] as number[], gaps: [] as Gap[] };
    // stage position -> page units: the page is drawn at (M, M), scaled
    if (!anchor.endsWith("center")) {
      const x = nearest((pos.x - M) / scale, targets.xs, threshold);
      if (x !== null) {
        out.x = M + x * scale;
        found.v.push(x);
      }
    }
    if (!anchor.startsWith("middle")) {
      const y = nearest((pos.y - M) / scale, targets.ys, threshold);
      if (y !== null) {
        out.y = M + y * scale;
        found.h.push(y);
      }
    }
    setGuides(found);
    return out;
  };

  const onTransformEnd = () => {
    resizeTargets.current = null;
    setGuides(noGuides);
    const tr = transformer.current;
    if (!tr) return;
    const byId = new Map(activeElements(store.getState()).map((el) => [el.id, el]));
    const updates: Record<string, Partial<Element>> = {};
    for (const node of tr.nodes()) {
      const el = byId.get(node.id());
      if (!el) continue;
      const sx = Math.abs(node.scaleX());
      const sy = Math.abs(node.scaleY());
      const rotation = round2(node.rotation());
      let update: Partial<Element>;
      if (el.type === "group") {
        // groups resize evenly; everything inside grows or shrinks with them
        const scaled = scaleElement(el, sx);
        update = { width: scaled.width, height: scaled.height, children: (scaled as typeof el).children, rotation, x: round2(node.x() - scaled.width / 2), y: round2(node.y() - scaled.height / 2) };
      } else if (el.type === "line") {
        // the side handles change the length; the thickness stays
        const length = clamp(el.width * sx, 1, 100_000);
        update = { width: round2(length), rotation, x: round2(node.x() - length / 2), y: round2(node.y() - el.height / 2) };
      } else {
        const width = clamp(el.width * sx, 1, 100_000);
        const transformedHeight = clamp(el.height * sy, 1, 100_000);
        let height = transformedHeight;
        update = { rotation };
        if (el.type === "text") {
          // corners scale the text; the side handles only change where it wraps
          const fontSize = clamp(Math.abs(sx - sy) < 0.001 ? el.font_size * sx : el.font_size, 1, 800);
          height = measureTextHeight({ ...el, width, font_size: fontSize });
          Object.assign(update, { font_size: round2(fontSize) });
        }
        // the node's position is its centre; if re-wrapping changed the height, keep the top-left corner
        const { x, y } = keepTopLeft(node.x(), node.y(), width, transformedHeight, width, height, node.rotation());
        Object.assign(update, { x, y, width: round2(width), height: round2(height) });
      }
      node.scaleX(el.flip_x ? -1 : 1);
      node.scaleY(el.flip_y ? -1 : 1);
      // Konva can report the end of a transform once per node: only real changes count
      if (Object.entries(update).some(([k, v]) => (el as unknown as Record<string, unknown>)[k] !== v)) updates[el.id] = update;
    }
    if (Object.keys(updates).length) store.getState().change((els) => patch(els, updates));
  };

  // --- moving: everything selected moves together, snapping to the page and other elements ------
  // (done by hand rather than with Konva's dragging, which moves the other selected nodes itself)
  const startMove = (page: number, from: { x: number; y: number }, clickedId: string) => {
    const s = store.getState();
    const els = activeElements(s);
    const moving = els.filter((x) => s.selectedIds.includes(x.id) && !x.locked);
    if (moving.length === 0) return;
    const start = new Map(moving.map((x) => [x.id, { cx: x.x + x.width / 2, cy: x.y + x.height / 2 }]));
    const box0 = union(moving.map(bounds))!;
    const others = els.filter((x) => !s.selectedIds.includes(x.id)).map(bounds);
    const pageBox = { x: 0, y: 0, width: pageW, height: pageH };
    let moved = false;
    let last = { dx: 0, dy: 0 };
    followPointer(
      page,
      (p, evt) => {
        let dx = p.x - from.x;
        let dy = p.y - from.y;
        if (!moved && Math.hypot(dx, dy) * scale < 3) return; // still a click
        moved = true;
        const found = { v: [] as number[], h: [] as number[], gaps: [] as Gap[] };
        if (!evt.altKey) {
          const threshold = SNAP_SCREEN_PX / scale;
          const snap = snapBox({ ...box0, x: box0.x + dx, y: box0.y + dy }, others, pageBox, threshold);
          dx += snap.dx;
          dy += snap.dy;
          found.v = snap.vertical;
          found.h = snap.horizontal;
          // equal spacing, on an axis where no edge or centre lined up
          if (!snap.vertical.length) {
            const sp = spacingSnap({ ...box0, x: box0.x + dx, y: box0.y + dy }, others, threshold).x;
            if (sp) {
              dx += sp.delta;
              found.gaps.push(...sp.gaps);
            }
          }
          if (!snap.horizontal.length) {
            const sp = spacingSnap({ ...box0, x: box0.x + dx, y: box0.y + dy }, others, threshold).y;
            if (sp) {
              dy += sp.delta;
              found.gaps.push(...sp.gaps);
            }
          }
        }
        last = { dx, dy };
        for (const [id, c] of start) nodeOn(page, id)?.position({ x: c.cx + dx, y: c.cy + dy });
        transformer.current?.forceUpdate();
        stages.current[page]?.batchDraw();
        setGuides(found);
      },
      () => {
        setGuides(noGuides);
        const now = store.getState();
        if (moved) now.change((els) => nudge(els, [...start.keys()], last.dx, last.dy));
        else if (now.selectedIds.length > 1) now.select([clickedId]); // a plain click picks just this one
      },
    );
  };

  // --- drag a box on empty page space to select ---------------------------------------------------
  const startMarquee = (page: number, from: { x: number; y: number }, additive: boolean) => {
    let current: Box | null = null;
    followPointer(
      page,
      (p) => {
        current = { x: Math.min(from.x, p.x), y: Math.min(from.y, p.y), width: Math.abs(p.x - from.x), height: Math.abs(p.y - from.y) };
        setMarquee(current);
      },
      () => {
        setMarquee(null);
        const s = store.getState();
        const b = current as Box | null;
        if (!b || (b.width * scale < 3 && b.height * scale < 3)) {
          if (!additive) s.select([]); // a click on empty space
          return;
        }
        const hit = activeElements(s).filter((el) => intersects(bounds(el), b)).map((el) => el.id);
        s.select(additive ? [...new Set([...s.selectedIds, ...hit])] : hit);
      },
    );
  };

  // --- export: any page, at the design's real size ------------------------------------------------
  useEffect(() => {
    exportRef.current = (page, type, quality) => {
      const s = stages.current[page];
      if (!s || !scale) throw new Error("The page isn't ready yet.");
      // the selection box and guides are not part of the design (they only exist on the active page)
      const tr = page === active ? transformer.current : null;
      tr?.hide();
      try {
        return s.toDataURL({ x: M, y: M, width: pw, height: ph, pixelRatio: 1 / scale, mimeType: type, quality });
      } finally {
        tr?.show();
      }
    };
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, scale, active, M, pw, ph]);

  return (
    <div
      ref={box}
      tabIndex={0}
      data-canvas
      aria-label="Canvas. Arrow keys move the selection, Delete removes it, Enter edits selected text."
      className="relative min-h-0 flex-1 overflow-auto bg-workspace outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      onMouseDown={(e) => {
        // a click on the grey workspace (not a page) clears the selection
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.workspace !== undefined) store.getState().select([]);
      }}
    >
      {scale > 0 && (
        <div data-workspace className="mx-auto flex w-max flex-col" style={{ padding: colours.pad, gap: colours.gap }}>
          {pages.map((page, i) => (
            <section
              key={page.id}
              ref={(el) => {
                blocks.current[i] = el;
              }}
              aria-label={`Page ${i + 1} of ${pages.length}`}
            >
              <PageHeader index={i} count={pages.length} active={i === active} readOnly={readOnly} width={pw} height={colours.labelH} />
              {/* hidden from screen readers: the element list describes the page instead */}
              <div aria-hidden className="relative" style={{ width: pw, height: ph }}>
                {/* the page's shadow, behind the (transparent) canvas */}
                <div className={cn("pointer-events-none absolute inset-0 shadow-page", i === active && pages.length > 1 && "ring-2 ring-accent")} />
                {editing && i === active && (
                  // outside Konva, so screen readers reach the text area
                  <TextEditor
                    key={editing.id}
                    el={editing}
                    left={editing.x * scale}
                    top={editing.y * scale}
                    scale={scale}
                    onDone={(text) => {
                      commitText(store, editing.id, text);
                      focusCanvas();
                    }}
                  />
                )}
                <div className="absolute" style={{ left: -M, top: -M }}>
                  <Stage
                    ref={(st) => {
                      stages.current[i] = st;
                    }}
                    width={pw + 2 * M}
                    height={ph + 2 * M}
                    onMouseDown={(e) => {
                      focusCanvas();
                      if (e.evt.button !== 0) return;
                      if (e.target === e.target.getStage()) {
                        store.getState().select([]); // the margin around the page
                        return;
                      }
                      if (e.target.name() !== "page") return; // elements and handles handle themselves
                      store.getState().setActivePage(i);
                      startMarquee(i, toPage(i), e.evt.shiftKey);
                    }}
                  >
                    <Layer>
                      <Group x={M} y={M} scaleX={scale} scaleY={scale} clipX={0} clipY={0} clipWidth={pageW} clipHeight={pageH}>
                        <Rect name="page" width={pageW} height={pageH} fill={page.background.color} />
                        {page.elements.map((el) => (
                          <Group
                            key={el.id}
                            id={el.id}
                            {...placement(el)}
                            onMouseDown={(e) => {
                              e.cancelBubble = true;
                              focusCanvas();
                              if (e.evt.button !== 0) return;
                              const s = store.getState();
                              if (s.activePage !== i) {
                                s.setActivePage(i); // a click on another page's element moves there
                                s.select([el.id]);
                              } else if (e.evt.shiftKey) {
                                s.toggleSelect(el.id); // Shift-click adds or removes; it doesn't start a move
                                return;
                              } else if (!s.selectedIds.includes(el.id)) {
                                s.select([el.id]);
                              }
                              if (!readOnly) startMove(i, toPage(i), el.id);
                            }}
                            onTap={() => {
                              store.getState().setActivePage(i);
                              store.getState().select([el.id]);
                            }}
                            onDblClick={() => {
                              if (el.type === "text" && !readOnly && !el.locked) store.getState().setEditing(el.id);
                            }}
                            onDblTap={() => {
                              if (el.type === "text" && !readOnly && !el.locked) store.getState().setEditing(el.id);
                            }}
                          >
                            <ElementNode el={el} colours={colours} />
                          </Group>
                        ))}
                      </Group>
                      {i === active && (
                        <>
                          {/* guides and the marquee are drawn over everything, not clipped to the page */}
                          <Group x={M} y={M} scaleX={scale} scaleY={scale} listening={false}>
                            {guides.v.map((x) => (
                              <Line key={`v${x}`} points={[x, 0, x, pageH]} stroke={colours.guide} strokeWidth={1} strokeScaleEnabled={false} />
                            ))}
                            {guides.h.map((y) => (
                              <Line key={`h${y}`} points={[0, y, pageW, y]} stroke={colours.guide} strokeWidth={1} strokeScaleEnabled={false} />
                            ))}
                            {guides.gaps.map((g) => {
                              // an equal gap: a line across it and its size in px (components.md, SmartGuides)
                              const length = Math.round(Math.hypot(g.x2 - g.x1, g.y2 - g.y1));
                              return (
                                <Group key={`${g.x1},${g.y1},${g.x2},${g.y2}`}>
                                  <Line points={[g.x1, g.y1, g.x2, g.y2]} stroke={colours.guide} strokeWidth={1} strokeScaleEnabled={false} />
                                  <Label x={(g.x1 + g.x2) / 2} y={(g.y1 + g.y2) / 2} scaleX={1 / scale} scaleY={1 / scale}>
                                    <Tag fill={colours.guide} cornerRadius={3} />
                                    <Text text={`${length}`} fontSize={11} padding={3} fill={colours.onGuide} offsetX={8} offsetY={8} />
                                  </Label>
                                </Group>
                              );
                            })}
                            {marquee && <Rect {...marquee} stroke={colours.selection} strokeWidth={1} strokeScaleEnabled={false} dash={[4, 4]} />}
                          </Group>
                          <Transformer
                            ref={transformer}
                            enabledAnchors={anchors}
                            keepRatio={keepRatio}
                            rotationSnaps={ROTATION_SNAPS}
                            rotationSnapTolerance={5}
                            rotateAnchorOffset={24}
                            anchorSize={8}
                            anchorStroke={colours.selection}
                            anchorFill={colours.handleFill}
                            borderStroke={colours.selection}
                            borderStrokeWidth={1.5}
                            ignoreStroke
                            boundBoxFunc={(oldBox, newBox) => (Math.max(newBox.width, newBox.height) < 5 ? oldBox : newBox)}
                            anchorDragBoundFunc={(_old, pos, evt) => snapAnchor(pos, evt as { altKey?: boolean } | undefined)}
                            onTransformStart={onTransformStart}
                            onTransformEnd={onTransformEnd}
                          />
                        </>
                      )}
                    </Layer>
                  </Stage>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
