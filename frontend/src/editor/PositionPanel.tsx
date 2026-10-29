// S13 Position (Arrange): layer order, align, flip, and exact X / Y / size / rotation for one element.
// Opens from the toolbar's Position button. The Layers list is its own side-panel tab (LayersPanel.tsx).
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  FlipHorizontal2,
  FlipVertical2,
  Layers,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Element } from "../lib/document";
import { Button, IconButton } from "../components/ui/Button";
import { NumberField } from "../components/ui/inputs";
import { Popover } from "../components/ui/overlays";
import { alignSelection, flipSelection, moveLayers, setElementGeometry } from "./commands";
import type { EditorStore } from "./store";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function PositionButton({ store, chosen }: { store: EditorStore; chosen: Element[] }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton label="Position" size="sm">
          <Layers strokeWidth={1.75} aria-hidden />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content label="Position" align="center" className="flex w-80 flex-col gap-4">
        <PositionPanel store={store} chosen={chosen} />
      </Popover.Content>
    </Popover.Root>
  );
}

function PositionPanel({ store, chosen }: { store: EditorStore; chosen: Element[] }) {
  const alignTo = chosen.length === 1 ? "to page" : "together";
  const only = chosen.length === 1 ? chosen[0] : null;
  return (
    <>
      <Section title="Layer order">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" icon={<ArrowUp className="size-4" aria-hidden />} title="Ctrl+]" onClick={() => moveLayers(store, "forward")}>
            Forward
          </Button>
          <Button size="sm" icon={<ArrowDown className="size-4" aria-hidden />} title="Ctrl+[" onClick={() => moveLayers(store, "backward")}>
            Backward
          </Button>
          <Button size="sm" icon={<ArrowUpToLine className="size-4" aria-hidden />} title="Ctrl+Shift+]" onClick={() => moveLayers(store, "front")}>
            To front
          </Button>
          <Button size="sm" icon={<ArrowDownToLine className="size-4" aria-hidden />} title="Ctrl+Shift+[" onClick={() => moveLayers(store, "back")}>
            To back
          </Button>
        </div>
      </Section>

      <Section title={`Align ${alignTo}`}>
        <div className="flex justify-between">
          <IconButton label={`Align left ${alignTo}`} onClick={() => alignSelection(store, "left")}>
            <AlignStartVertical strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Centre ${alignTo}`} onClick={() => alignSelection(store, "center")}>
            <AlignCenterVertical strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Align right ${alignTo}`} onClick={() => alignSelection(store, "right")}>
            <AlignEndVertical strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Align top ${alignTo}`} onClick={() => alignSelection(store, "top")}>
            <AlignStartHorizontal strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Middle ${alignTo}`} onClick={() => alignSelection(store, "middle")}>
            <AlignCenterHorizontal strokeWidth={1.75} aria-hidden />
          </IconButton>
          <IconButton label={`Align bottom ${alignTo}`} onClick={() => alignSelection(store, "bottom")}>
            <AlignEndHorizontal strokeWidth={1.75} aria-hidden />
          </IconButton>
        </div>
      </Section>

      <Section title="Flip">
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" icon={<FlipHorizontal2 className="size-4" aria-hidden />} onClick={() => flipSelection(store, "x")}>
            Flip horizontal
          </Button>
          <Button size="sm" icon={<FlipVertical2 className="size-4" aria-hidden />} onClick={() => flipSelection(store, "y")}>
            Flip vertical
          </Button>
        </div>
      </Section>

      {only && !only.locked && <SizeAndPosition store={store} el={only} />}
    </>
  );
}

/** Typed values; each box saves on Enter or when you leave it (one undo step each). */
function SizeAndPosition({ store, el }: { store: EditorStore; el: Element }) {
  const set = (g: Parameters<typeof setElementGeometry>[2]) => setElementGeometry(store, el.id, g);
  const heightNote = el.type === "text" ? "Follows the text" : el.type === "line" ? "The line's thickness" : undefined;
  const proportional = el.type === "image" || el.type === "group";
  return (
    <Section title="Size and position">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" unit="px" size="sm" value={el.x} onCommit={(x) => set({ x })} />
        <NumberField label="Y" unit="px" size="sm" value={el.y} onCommit={(y) => set({ y })} />
        <NumberField label="Width" unit="px" size="sm" value={el.width} onCommit={(width) => set({ width })} />
        <NumberField label="Height" unit="px" size="sm" value={el.height} onCommit={(height) => set({ height })} disabled={!!heightNote} hint={heightNote} />
        <NumberField label="Rotation" unit="°" size="sm" value={el.rotation} onCommit={(rotation) => set({ rotation })} />
      </div>
      {proportional && <p className="text-xs text-muted">{el.type === "image" ? "Photos" : "Groups"} keep their proportions: width and height change together.</p>}
    </Section>
  );
}
