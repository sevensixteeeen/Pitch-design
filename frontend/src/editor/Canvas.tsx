// S08 canvas (Konva). Draws the first page, fitted into the workspace.
// Milestone 1: click to select, drag to move. Resize, rotate, zoom and
// guides come in milestone 2.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Ellipse, Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { Element, ImageElement, TextElement } from "../lib/document";
import { useEditor } from "./store";

/** Canvas colours come from the design tokens (components.md, ground rules). */
function tokenColours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    selection: v("--tk-color-selection"),
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

function fontStyle(el: TextElement) {
  if (el.bold && el.italic) return "italic bold";
  if (el.bold) return "bold";
  return el.italic ? "italic" : "normal";
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
  const design = useEditor((s) => s.design);
  const page = useEditor((s) => s.content.pages[0]);
  const selectedId = useEditor((s) => s.selectedId);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const moveElement = useEditor((s) => s.moveElement);

  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(box);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const [colours] = useState(tokenColours);

  // fit the page into the workspace, centred
  const pageW = design.width_px;
  const pageH = design.height_px;
  const scale = width && height ? Math.min((width - 2 * colours.pad) / pageW, (height - 2 * colours.pad) / pageH, 4) : 0;
  const pageX = (width - pageW * scale) / 2;
  const pageY = (height - pageH * scale) / 2;

  // the selection box follows the selected element
  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const node = selectedId ? stage.current?.findOne((n: Konva.Node) => n.id() === selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, page, scale]);

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
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-workspace">
      {scale > 0 && (
        // hidden from screen readers: <ElementList> describes the page instead
        <div aria-hidden>
          {/* the page's shadow, behind the (transparent) canvas */}
          <div className="pointer-events-none absolute shadow-page" style={{ left: pageX, top: pageY, width: pageW * scale, height: pageH * scale }} />
          <Stage
            ref={stage}
            width={width}
            height={height}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage() || e.target.name() === "page") select(null);
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
                    draggable={!readOnly && !el.locked}
                    onMouseDown={() => select(el.id)}
                    onTap={() => select(el.id)}
                    onDragStart={() => select(el.id)}
                    onDragEnd={(e) => moveElement(el.id, Math.round(e.target.x() - el.width / 2), Math.round(e.target.y() - el.height / 2))}
                  >
                    <ElementNode el={el} colours={colours} />
                  </Group>
                ))}
              </Group>
              <Transformer ref={transformer} resizeEnabled={false} rotateEnabled={false} borderStroke={colours.selection} borderStrokeWidth={1.5} />
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
