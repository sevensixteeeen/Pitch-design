// The canvas's right-click menu (S08). Right-clicking an element selects it first (Canvas.tsx), so the
// menu always acts on what's selected; on empty space it offers paste and select all. The keyboard's
// menu key (or Shift+F10) on the canvas opens it too.
import type { ReactNode } from "react";
import { ContextMenu } from "../components/ui/overlays";
import { copySelection, cutSelection, hasClipboard, paste } from "./clipboard";
import { deleteSelection, duplicateSelection, groupSelection, moveLayers, selectAll, toggleLock, ungroupSelection } from "./commands";
import { activeElements, useEditor, useEditorStore } from "./store";

export function CanvasMenu({ children }: { children: ReactNode }) {
  const readOnly = useEditor((s) => s.readOnly);
  const editing = useEditor((s) => s.editingId !== null);
  return (
    <ContextMenu.Root>
      {/* while typing in a text box, the browser's own menu (spelling, paste) is the useful one */}
      <ContextMenu.Trigger asChild disabled={readOnly || editing}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Content label="Canvas menu">
        <Items />
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

/** Rendered when the menu opens, so it reflects the selection at that moment. */
function Items() {
  const store = useEditorStore();
  const selectedIds = useEditor((s) => s.selectedIds);
  const chosen = useEditor(activeElements).filter((el) => selectedIds.includes(el.id));
  const canPaste = hasClipboard();

  if (chosen.length === 0) {
    return (
      <>
        <ContextMenu.Item shortcut="Ctrl+V" disabled={!canPaste} onSelect={() => paste(store)}>
          Paste
        </ContextMenu.Item>
        <ContextMenu.Item shortcut="Ctrl+A" onSelect={() => selectAll(store)}>
          Select all
        </ContextMenu.Item>
      </>
    );
  }

  const allLocked = chosen.every((el) => el.locked);
  const canGroup = chosen.filter((el) => !el.locked).length >= 2;
  const hasGroup = chosen.some((el) => el.type === "group" && !el.locked);
  return (
    <>
      <ContextMenu.Item shortcut="Ctrl+C" onSelect={() => copySelection(store)}>
        Copy
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+X" disabled={allLocked} onSelect={() => cutSelection(store)}>
        Cut
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+V" disabled={!canPaste} onSelect={() => paste(store)}>
        Paste
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+D" onSelect={() => duplicateSelection(store)}>
        Duplicate
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Delete" danger disabled={allLocked} onSelect={() => deleteSelection(store)}>
        Delete
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item shortcut="Ctrl+]" disabled={allLocked} onSelect={() => moveLayers(store, "forward")}>
        Bring forward
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+[" disabled={allLocked} onSelect={() => moveLayers(store, "backward")}>
        Send backward
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+Shift+]" disabled={allLocked} onSelect={() => moveLayers(store, "front")}>
        Bring to front
      </ContextMenu.Item>
      <ContextMenu.Item shortcut="Ctrl+Shift+[" disabled={allLocked} onSelect={() => moveLayers(store, "back")}>
        Send to back
      </ContextMenu.Item>
      <ContextMenu.Separator />
      {canGroup && (
        <ContextMenu.Item shortcut="Ctrl+G" onSelect={() => groupSelection(store)}>
          Group
        </ContextMenu.Item>
      )}
      {hasGroup && (
        <ContextMenu.Item shortcut="Ctrl+Shift+G" onSelect={() => ungroupSelection(store)}>
          Ungroup
        </ContextMenu.Item>
      )}
      <ContextMenu.Item onSelect={() => toggleLock(store)}>{allLocked ? "Unlock" : "Lock"}</ContextMenu.Item>
    </>
  );
}
