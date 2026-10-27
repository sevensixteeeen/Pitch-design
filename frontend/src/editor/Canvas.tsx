// S08 canvas (Konva). Draws the first page; select (click, Shift-click, drag a
// box), move with snapping guides, resize and rotate with handles, zoom.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { Element, ImageElement } from "../lib/document";
import { cn } from "../lib/cn";
import { bounds, clamp, fontStyle, intersects, measureTextHeight, round2, snapBox, union, type Box } from "./geometry";
import { nudge, patch } from "./ops";
import { useEditor, useEditorStore } from "./store";

const SNAP_SCREEN_PX = 5; // components.md, SmartGuides
const MAX_STAGE_PX = 12_000; // keep the canvas within what browsers can draw
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const SIDES_X = ["middle-left", "middle-right"];
const ALL_ANCHORS = [...CORNERS, ...SIDES_X, "top-center", "bottom-center"];
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Canvas colours come from the design tokens (components.md, ground rules). */
function tokenColours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    selection: v("--tk-color-selection"),
    guide: v("--tk-color-guide"),
    handleFill: v("--tk-color-bg"),
    placeholderFill: v("--tk-color-surface-hover"),
    placeholderLine: v("--tk-color-border-input"),
    placeholderText: v("--tk-color-text-muted"),
    pad: parseFloat(v("--tk-space-8")) || 0, // room around the page
  };
}
type Colours = ReturnType<typeof tokenColours>;

/** Saves the page as a PNG at the design's real size. Set by <Canvas>. */
export type ExportPng = () => string;

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

function ElementNode({ el, colours }: { el: Element; colours: Colours }) {
  const url = useEditor((s) => (el.type === "image" ? s.assetUrls[el.src.asset_id] : undefined));
  switch (el.type) {
    case "text":
      return (
        <Text
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
    case "shape":
      return el.kind === "ellipse" ? (
        <Ellipse
          x={el.width / 2}
          y={el.height / 2}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={el.fill}
          stroke={el.stroke ?? undefined}
          strokeWidth={el.stroke_width}
        />
      ) : (
        <Rect width={el.width} height={el.height} fill={el.fill} stroke={el.stroke ?? undefined} strokeWidth={el.stroke_width} cornerRadius={el.corner_radius} />
      );
    case "image":
      return <ImageNode el={el} url={url} colours={colours} />;
  }
}

export function Canvas({ exportRef }: { exportRef: RefObject<ExportPng | null> }) {
  const store = useEditorStore();
  const design = useEditor((s) => s.design);
  const page = useEditor((s) => s.content.pages[0]);
  const selectedIds = useEditor((s) => s.selectedIds);
  const readOnly = useEditor((s) => s.readOnly);
  const zoom = useEditor((s) => s.zoom);

  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(box);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const [colours] = useState(tokenColours);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<Box | null>(null);

  // --- view: fit the page, or a fixed zoom with scrolling ---------------------------------------
  const pageW = design.width_px;
  const pageH = design.height_px;
  const fit = width && height ? clamp(Math.min((width - 2 * colours.pad) / pageW, (height - 2 * colours.pad) / pageH), 0.01, 4) : 0;
  const max = Math.max(fit, Math.min(4, MAX_STAGE_PX / Math.max(pageW, pageH)));
  const min = Math.min(fit, 0.1);
  const scale = zoom === "fit" ? fit : clamp(zoom, min, max);
  const stageW = Math.max(width, pageW * scale + 2 * colours.pad);
  const stageH = Math.max(height, pageH * scale + 2 * colours.pad);
  const pageX = (stageW - pageW * scale) / 2;
  const pageY = (stageH - pageH * scale) / 2;

  useEffect(() => {
    if (fit) store.getState().setView({ scale, fit, min, max });
  }, [store, scale, fit, min, max]);

  // after a zoom change, show the middle of the page
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [scale]);

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

  const nodeById = (id: string) => stage.current?.findOne((n: Konva.Node) => n.id() === id);
  const toPage = () => {
    const p = stage.current?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: (p.x - pageX) / scale, y: (p.y - pageY) / scale };
  };
  const focusCanvas = () => box.current?.focus({ preventScroll: true });

  /** Follows the mouse until it is released, even outside the canvas. Positions are in page units. */
  const followPointer = (onMove: (p: { x: number; y: number }, evt: MouseEvent) => void, onUp: () => void) => {
    const move = (evt: MouseEvent) => {
      stage.current?.setPointersPositions(evt);
      onMove(toPage(), evt);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      onUp();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // --- selection box with handles ---------------------------------------------------------------
  const chosen = readOnly ? [] : page.elements.filter((el) => selectedIds.includes(el.id) && !el.locked);
  const only = chosen.length === 1 ? chosen[0] : null;
  const anchors = !only ? CORNERS : only.type === "text" ? [...CORNERS, ...SIDES_X] : only.type === "image" ? CORNERS : ALL_ANCHORS;
  const chosenKey = chosen.map((el) => el.id).join(",");

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    tr.nodes(chosen.map((el) => nodeById(el.id)).filter((n): n is Konva.Node => !!n));
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
    // nodes are found by id after each render; page and scale change their geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey, page, scale]);

  const onTransformEnd = () => {
    const tr = transformer.current;
    if (!tr) return;
    const byId = new Map(store.getState().content.pages[0].elements.map((el) => [el.id, el]));
    const updates: Record<string, Partial<Element>> = {};
    for (const node of tr.nodes()) {
      const el = byId.get(node.id());
      if (!el) continue;
      const sx = Math.abs(node.scaleX());
      const sy = Math.abs(node.scaleY());
      const width = clamp(el.width * sx, 1, 100_000);
      const transformedHeight = clamp(el.height * sy, 1, 100_000);
      let height = transformedHeight;
      const update: Partial<Element> = { rotation: round2(node.rotation()) };
      if (el.type === "text") {
        // corners scale the text; the side handles only change where it wraps
        const fontSize = clamp(Math.abs(sx - sy) < 0.001 ? el.font_size * sx : el.font_size, 1, 800);
        height = measureTextHeight({ ...el, width, font_size: fontSize });
        Object.assign(update, { font_size: round2(fontSize) });
      }
      // The node's position is its centre (see the element groups below). If re-wrapping changed the
      // text's height, keep the box's top-left corner where the handles left it (also when rotated),
      // so the text grows or shrinks downward instead of jumping.
      const a = (node.rotation() * Math.PI) / 180;
      const turn = (dx: number, dy: number) => ({ x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) });
      const corner = turn(-width / 2, -transformedHeight / 2);
      const toCentre = turn(width / 2, height / 2);
      const cx = node.x() + corner.x + toCentre.x;
      const cy = node.y() + corner.y + toCentre.y;
      Object.assign(update, { x: round2(cx - width / 2), y: round2(cy - height / 2), width: round2(width), height: round2(height) });
      node.scaleX(el.flip_x ? -1 : 1);
      node.scaleY(el.flip_y ? -1 : 1);
      // Konva can report the end of a transform once per node: only real changes count
      if (Object.entries(update).some(([k, v]) => (el as unknown as Record<string, unknown>)[k] !== v)) updates[el.id] = update;
    }
    if (Object.keys(updates).length) store.getState().change((els) => patch(els, updates));
  };

  // --- moving: everything selected moves together, snapping to the page and other elements ------
  // (done by hand rather than with Konva's dragging, which moves the other selected nodes itself)
  const startMove = (from: { x: number; y: number }, clickedId: string) => {
    const s = store.getState();
    const els = s.content.pages[0].elements;
    const moving = els.filter((x) => s.selectedIds.includes(x.id) && !x.locked);
    if (moving.length === 0) return;
    const start = new Map(moving.map((x) => [x.id, { cx: x.x + x.width / 2, cy: x.y + x.height / 2 }]));
    const box0 = union(moving.map(bounds))!;
    const others = els.filter((x) => !s.selectedIds.includes(x.id)).map(bounds);
    const pageBox = { x: 0, y: 0, width: pageW, height: pageH };
    let moved = false;
    let last = { dx: 0, dy: 0 };
    followPointer(
      (p, evt) => {
        let dx = p.x - from.x;
        let dy = p.y - from.y;
        if (!moved && Math.hypot(dx, dy) * scale < 3) return; // still a click
        moved = true;
        let found = { v: [] as number[], h: [] as number[] };
        if (!evt.altKey) {
          const snap = snapBox({ ...box0, x: box0.x + dx, y: box0.y + dy }, others, pageBox, SNAP_SCREEN_PX / scale);
          dx += snap.dx;
          dy += snap.dy;
          found = { v: snap.vertical, h: snap.horizontal };
        }
        last = { dx, dy };
        for (const [id, c] of start) nodeById(id)?.position({ x: c.cx + dx, y: c.cy + dy });
        transformer.current?.forceUpdate();
        stage.current?.batchDraw();
        setGuides(found);
      },
      () => {
        setGuides({ v: [], h: [] });
        const now = store.getState();
        if (moved) now.change((els) => nudge(els, [...start.keys()], last.dx, last.dy));
        else if (now.selectedIds.length > 1) now.select([clickedId]); // a plain click picks just this one
      },
    );
  };

  // --- drag a box on empty space to select ------------------------------------------------------
  const startMarquee = (from: { x: number; y: number }, additive: boolean) => {
    let current: Box | null = null;
    followPointer(
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
        const hit = s.content.pages[0].elements.filter((el) => intersects(bounds(el), b)).map((el) => el.id);
        s.select(additive ? [...new Set([...s.selectedIds, ...hit])] : hit);
      },
    );
  };

  // --- export ---------------------------------------------------------------------------------
  useEffect(() => {
    exportRef.current = () => {
      const s = stage.current;
      const tr = transformer.current;
      if (!s || !scale) throw new Error("The page isn't ready yet.");
      tr?.hide(); // the selection box is not part of the design
      try {
        return s.toDataURL({ x: pageX, y: pageY, width: pageW * scale, height: pageH * scale, pixelRatio: 1 / scale, mimeType: "image/png" });
      } finally {
        tr?.show();
      }
    };
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, scale, pageX, pageY, pageW, pageH]);

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="Canvas. Arrow keys move the selection, Delete removes it."
      className={cn("relative min-h-0 flex-1 overflow-auto bg-workspace outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset")}
    >
      {scale > 0 && (
        // hidden from screen readers: the element list describes the page instead
        <div aria-hidden className="relative" style={{ width: stageW, height: stageH }}>
          {/* the page's shadow, behind the (transparent) canvas */}
          <div className="pointer-events-none absolute shadow-page" style={{ left: pageX, top: pageY, width: pageW * scale, height: pageH * scale }} />
          <Stage
            ref={stage}
            width={stageW}
            height={stageH}
            onMouseDown={(e) => {
              focusCanvas();
              if (e.evt.button !== 0) return;
              if (e.target !== e.target.getStage() && e.target.name() !== "page") return; // elements and handles handle themselves
              startMarquee(toPage(), e.evt.shiftKey);
            }}
          >
            <Layer>
              <Group x={pageX} y={pageY} scaleX={scale} scaleY={scale} clipX={0} clipY={0} clipWidth={pageW} clipHeight={pageH}>
                <Rect name="page" width={pageW} height={pageH} fill={page.background.color} />
                {page.elements.map((el) => (
                  // positioned by its centre, so rotation and flips turn around the middle
                  <Group
                    key={el.id}
                    id={el.id}
                    x={el.x + el.width / 2}
                    y={el.y + el.height / 2}
                    offsetX={el.width / 2}
                    offsetY={el.height / 2}
                    rotation={el.rotation}
                    scaleX={el.flip_x ? -1 : 1}
                    scaleY={el.flip_y ? -1 : 1}
                    opacity={el.opacity}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      focusCanvas();
                      if (e.evt.button !== 0) return;
                      const s = store.getState();
                      if (e.evt.shiftKey) {
                        s.toggleSelect(el.id); // Shift-click adds or removes; it doesn't start a move
                        return;
                      }
                      if (!s.selectedIds.includes(el.id)) s.select([el.id]);
                      if (!readOnly) startMove(toPage(), el.id);
                    }}
                    onTap={() => store.getState().select([el.id])}
                  >
                    <ElementNode el={el} colours={colours} />
                  </Group>
                ))}
              </Group>
              {/* guides and the selection box are drawn over everything, not clipped to the page */}
              <Group x={pageX} y={pageY} scaleX={scale} scaleY={scale} listening={false}>
                {guides.v.map((x) => (
                  <Line key={`v${x}`} points={[x, 0, x, pageH]} stroke={colours.guide} strokeWidth={1} strokeScaleEnabled={false} />
                ))}
                {guides.h.map((y) => (
                  <Line key={`h${y}`} points={[0, y, pageW, y]} stroke={colours.guide} strokeWidth={1} strokeScaleEnabled={false} />
                ))}
                {marquee && (
                  <Rect {...marquee} stroke={colours.selection} strokeWidth={1} strokeScaleEnabled={false} dash={[4, 4]} />
                )}
              </Group>
              <Transformer
                ref={transformer}
                enabledAnchors={anchors}
                keepRatio={!only || only.type !== "shape"}
                rotationSnaps={ROTATION_SNAPS}
                rotationSnapTolerance={5}
                rotateAnchorOffset={24}
                anchorSize={8}
                anchorStroke={colours.selection}
                anchorFill={colours.handleFill}
                borderStroke={colours.selection}
                borderStrokeWidth={1.5}
                ignoreStroke
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
                onTransformEnd={onTransformEnd}
              />
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
