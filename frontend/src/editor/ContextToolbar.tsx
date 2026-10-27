// S08 ContextToolbar (components.md), milestone 2a: opacity, position (layer order and
// alignment), duplicate, delete. Text, colour and other controls come in 2b.
import type { KeyboardEvent } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Contrast, Copy, Layers, Trash2 } from "lucide-react";
import { IconButton } from "../components/ui/Button";
import { Slider } from "../components/ui/inputs";
import { Menu, Popover } from "../components/ui/overlays";
import { alignSelection, deleteSelection, describeElement, duplicateSelection, moveLayers, setOpacity } from "./commands";
import { useEditor, useEditorStore } from "./store";

/** Left / Right move between the toolbar's buttons; Tab leaves the toolbar (components.md). */
function roving(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  buttons[(i + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length].focus();
}

export function ContextToolbar() {
  const store = useEditorStore();
  const selectedIds = useEditor((s) => s.selectedIds);
  const readOnly = useEditor((s) => s.readOnly);
  const elements = useEditor((s) => s.content.pages[0].elements);
  const chosen = elements.filter((el) => selectedIds.includes(el.id));
  if (readOnly || chosen.length === 0) return null;

  const opacity = Math.round(chosen[0].opacity * 100);
  const name = chosen.length === 1 ? describeElement(chosen[0]) : `${chosen.length} selected`;
  const alignTo = chosen.length === 1 ? "to page" : "together";

  return (
    <div
      role="toolbar"
      aria-label="Selected element"
      onKeyDown={roving}
      className="absolute top-2 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-app p-1 shadow-pop"
    >
      <span className="max-w-48 truncate px-2 text-xs text-muted" title={name}>
        {name}
      </span>
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
    </div>
  );
}
