// S08 ContextToolbar (components.md). Variants: text (S15 font, size, colour, bold/italic/underline,
// alignment, spacing), shape (S14 fill, outline), any selection (opacity, position, duplicate,
// delete), and the page when nothing is selected (background colour).
import type { KeyboardEvent, ReactNode } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  Bold,
  Check,
  Contrast,
  Copy,
  Italic,
  Layers,
  LetterText,
  Trash2,
  Underline,
} from "lucide-react";
import type { ShapeElement, TextElement } from "../lib/document";
import { Button, IconButton } from "../components/ui/Button";
import { NumberField, Slider } from "../components/ui/inputs";
import { Menu, Popover } from "../components/ui/overlays";
import { ColorButton } from "./ColorPicker";
import {
  alignSelection,
  deleteSelection,
  describeElement,
  duplicateSelection,
  moveLayers,
  setBackground,
  setOpacity,
  styleShapes,
  styleText,
} from "./commands";
import { FONTS, fontLabel } from "./fonts";
import { useEditor, useEditorStore, type EditorStore } from "./store";

/** Left / Right move between the toolbar's buttons; Tab leaves the toolbar (components.md). */
function roving(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  buttons[(i + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length].focus();
}

function Bar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      onKeyDown={roving}
      className="absolute top-2 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-app p-1 shadow-pop"
    >
      {children}
    </div>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px bg-border" />;

const ALIGNS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Centre", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
  { value: "justify", label: "Justify", icon: AlignJustify },
] as const;

function TextControls({ store, texts }: { store: EditorStore; texts: TextElement[] }) {
  const first = texts[0];
  const all = (key: "bold" | "italic" | "underline") => texts.every((t) => t[key]);
  const live = { onLiveEnd: () => store.getState().endGesture() };
  const AlignIcon = ALIGNS.find((a) => a.value === first.align)?.icon ?? AlignCenter;
  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="ghost" size="sm" className="w-36 justify-start" aria-label={`Font: ${fontLabel(first.font_family)}. Change font`}>
            <span className="truncate" style={{ fontFamily: `"${first.font_family}"` }}>
              {fontLabel(first.font_family)}
            </span>
          </Button>
        </Menu.Trigger>
        <Menu.Content>
          {FONTS.map((f) => (
            <Menu.Item key={f.family} onSelect={() => void styleText(store, { font_family: f.family })}>
              <span className="w-4">{f.family === first.font_family && <Check aria-hidden />}</span>
              {/* each font shown in itself (components.md, FontRow) */}
              <span style={{ fontFamily: `"${f.family}"` }}>{f.label}</span>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
      <div className="w-16">
        <NumberField
          label="Font size"
          hideLabel
          size="sm"
          decimals={1}
          value={first.font_size}
          onCommit={(v) => void styleText(store, { font_size: Math.min(800, Math.max(1, v)) })}
        />
      </div>
      <ColorButton
        label="Text colour"
        value={first.color}
        onPick={(c) => c && void styleText(store, { color: c })}
        onLive={(c) => void styleText(store, { color: c }, { gesture: true })}
        {...live}
      />
      <IconButton label="Bold" shortcut="Ctrl+B" size="sm" pressed={all("bold")} onClick={() => void styleText(store, { bold: !all("bold") })}>
        <Bold strokeWidth={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Italic" shortcut="Ctrl+I" size="sm" pressed={all("italic")} onClick={() => void styleText(store, { italic: !all("italic") })}>
        <Italic strokeWidth={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Underline" shortcut="Ctrl+U" size="sm" pressed={all("underline")} onClick={() => void styleText(store, { underline: !all("underline") })}>
        <Underline strokeWidth={1.75} aria-hidden />
      </IconButton>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton label="Alignment" size="sm">
            <AlignIcon strokeWidth={1.75} aria-hidden />
          </IconButton>
        </Menu.Trigger>
        <Menu.Content align="center">
          {ALIGNS.map(({ value, label, icon: Icon }) => (
            <Menu.Item key={value} onSelect={() => void styleText(store, { align: value })}>
              <Icon aria-hidden /> {label}
              {first.align === value && <Check aria-hidden className="ml-auto" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
      <Popover.Root>
        <Popover.Trigger asChild>
          <IconButton label="Spacing" size="sm">
            <LetterText strokeWidth={1.75} aria-hidden />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content label="Spacing" align="center" className="flex w-64 flex-col gap-4">
          {/* letter spacing is shown in thousandths of the font size, stored in px */}
          <Slider
            label="Letter spacing"
            min={-200}
            max={800}
            step={10}
            value={Math.round((first.letter_spacing / first.font_size) * 1000)}
            onChange={(v) => void styleText(store, (el) => ({ letter_spacing: Math.round((v / 1000) * el.font_size * 100) / 100 }), { gesture: true })}
            onCommit={() => store.getState().endGesture()}
          />
          <Slider
            label="Line height"
            min={0.5}
            max={3}
            step={0.05}
            value={first.line_height}
            onChange={(v) => void styleText(store, { line_height: Math.round(v * 100) / 100 }, { gesture: true })}
            onCommit={() => store.getState().endGesture()}
          />
        </Popover.Content>
      </Popover.Root>
      <Divider />
    </>
  );
}

function ShapeControls({ store, shapes }: { store: EditorStore; shapes: ShapeElement[] }) {
  const first = shapes[0];
  const live = { onLiveEnd: () => store.getState().endGesture() };
  return (
    <>
      <ColorButton
        label="Fill colour"
        value={first.fill}
        onPick={(c) => c && styleShapes(store, { fill: c })}
        onLive={(c) => styleShapes(store, { fill: c }, { gesture: true })}
        {...live}
      />
      <ColorButton
        label="Outline colour"
        value={first.stroke}
        allowNone
        onPick={(c) => styleShapes(store, c ? { stroke: c } : { stroke: null, stroke_width: 0 })}
        onLive={(c) => styleShapes(store, { stroke: c }, { gesture: true })}
        {...live}
      />
      {first.stroke && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="ghost" size="sm" className="tabular-nums" aria-label={`Outline width: ${first.stroke_width}. Change`}>
              {first.stroke_width} px
            </Button>
          </Popover.Trigger>
          <Popover.Content label="Outline width" align="center" className="w-64">
            <Slider
              label="Outline width"
              min={0}
              max={50}
              unit=" px"
              value={first.stroke_width}
              onChange={(v) => styleShapes(store, { stroke_width: v }, { gesture: true })}
              onCommit={() => store.getState().endGesture()}
            />
          </Popover.Content>
        </Popover.Root>
      )}
      <Divider />
    </>
  );
}

export function ContextToolbar() {
  const store = useEditorStore();
  const selectedIds = useEditor((s) => s.selectedIds);
  const readOnly = useEditor((s) => s.readOnly);
  const editing = useEditor((s) => s.editingId !== null);
  const page = useEditor((s) => s.content.pages[0]);
  if (readOnly || editing) return null;

  const chosen = page.elements.filter((el) => selectedIds.includes(el.id));
  if (chosen.length === 0) {
    return (
      <Bar label="Page">
        <span className="px-2 text-xs text-muted">Page</span>
        <ColorButton
          label="Background colour"
          value={page.background.color}
          onPick={(c) => c && setBackground(store, c)}
          onLive={(c) => setBackground(store, c, { gesture: true })}
          onLiveEnd={() => store.getState().endGesture()}
        />
      </Bar>
    );
  }

  const texts = chosen.filter((el): el is TextElement => el.type === "text");
  const shapes = chosen.filter((el): el is ShapeElement => el.type === "shape");
  const opacity = Math.round(chosen[0].opacity * 100);
  const name = chosen.length === 1 ? describeElement(chosen[0]) : `${chosen.length} selected`;
  const alignTo = chosen.length === 1 ? "to page" : "together";

  return (
    <Bar label="Selected element">
      <span className="max-w-40 truncate px-2 text-xs text-muted" title={name}>
        {name}
      </span>
      {texts.length === chosen.length && <TextControls store={store} texts={texts} />}
      {shapes.length === chosen.length && <ShapeControls store={store} shapes={shapes} />}
      <Popover.Root>
        <Popover.Trigger asChild>
          <IconButton label="Opacity" size="sm">
            <Contrast strokeWidth={1.75} aria-hidden />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content label="Opacity" align="center" className="w-64">
          <Slider label="Opacity" value={opacity} unit=" %" onChange={(v) => setOpacity(store, v / 100)} onCommit={() => store.getState().endGesture()} />
        </Popover.Content>
      </Popover.Root>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton label="Position" size="sm">
            <Layers strokeWidth={1.75} aria-hidden />
          </IconButton>
        </Menu.Trigger>
        <Menu.Content align="center">
          <Menu.Item onSelect={() => moveLayers(store, "forward")} shortcut="Ctrl+]">Bring forward</Menu.Item>
          <Menu.Item onSelect={() => moveLayers(store, "backward")} shortcut="Ctrl+[">Send backward</Menu.Item>
          <Menu.Item onSelect={() => moveLayers(store, "front")} shortcut="Ctrl+Shift+]">Bring to front</Menu.Item>
          <Menu.Item onSelect={() => moveLayers(store, "back")} shortcut="Ctrl+Shift+[">Send to back</Menu.Item>
          <Menu.Separator />
          <Menu.Item onSelect={() => alignSelection(store, "left")}>
            <AlignStartVertical aria-hidden /> Align left {alignTo}
          </Menu.Item>
          <Menu.Item onSelect={() => alignSelection(store, "center")}>
            <AlignCenterVertical aria-hidden /> Centre {alignTo}
          </Menu.Item>
          <Menu.Item onSelect={() => alignSelection(store, "right")}>
            <AlignEndVertical aria-hidden /> Align right {alignTo}
          </Menu.Item>
          <Menu.Item onSelect={() => alignSelection(store, "top")}>
            <AlignStartHorizontal aria-hidden /> Align top {alignTo}
          </Menu.Item>
          <Menu.Item onSelect={() => alignSelection(store, "middle")}>
            <AlignCenterHorizontal aria-hidden /> Middle {alignTo}
          </Menu.Item>
          <Menu.Item onSelect={() => alignSelection(store, "bottom")}>
            <AlignEndHorizontal aria-hidden /> Align bottom {alignTo}
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <IconButton label="Duplicate" shortcut="Ctrl+D" size="sm" onClick={() => duplicateSelection(store)}>
        <Copy strokeWidth={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Delete" shortcut="Delete" size="sm" onClick={() => deleteSelection(store)}>
        <Trash2 strokeWidth={1.75} aria-hidden />
      </IconButton>
    </Bar>
  );
}
