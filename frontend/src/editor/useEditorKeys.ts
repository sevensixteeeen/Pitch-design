// Keyboard shortcuts for the editor (components.md: SelectionBox keys, ZoomControl keys).
// Ignored while typing in a field; plain keys (arrows, Delete, Escape) are also left to menus,
// sliders, tabs and toolbars, which use them for their own navigation.
import { useEffect } from "react";
import { deleteSelection, duplicateSelection, moveLayers, nudgeSelection, selectAll } from "./commands";
import { stepZoom, type EditorStore } from "./store";

const TYPING = "input, textarea, select, [contenteditable='true']";
const WIDGETS = "[role='menu'], [role='dialog'], [role='slider'], [role='tablist'], [role='toolbar'], [role='listbox']";
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function useEditorKeys(store: EditorStore) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(TYPING)) return;
      const inWidget = !!target?.closest(WIDGETS);
      const s = store.getState();
      const key = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        const run = (fn: () => void) => {
          e.preventDefault();
          fn();
        };
        if (key === "z" && !e.shiftKey) run(s.undo);
        else if ((key === "z" && e.shiftKey) || key === "y") run(s.redo);
        else if (key === "d") run(() => duplicateSelection(store));
        else if (key === "a" && !inWidget) run(() => selectAll(store));
        else if (key === "=" || key === "+") run(() => s.setZoom(stepZoom(s.view, 1)));
        else if (key === "-") run(() => s.setZoom(stepZoom(s.view, -1)));
        else if (key === "0") run(() => s.setZoom("fit"));
        else if (key === "]" || key === "}") run(() => moveLayers(store, e.shiftKey ? "front" : "forward"));
        else if (key === "[" || key === "{") run(() => moveLayers(store, e.shiftKey ? "back" : "backward"));
        return;
      }
      if (inWidget) return;

      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedIds.length) {
        e.preventDefault();
        deleteSelection(store);
      } else if (e.key in ARROWS && s.selectedIds.length) {
        e.preventDefault();
        const [x, y] = ARROWS[e.key];
        const step = e.shiftKey ? 10 : 1;
        nudgeSelection(store, x * step, y * step);
      } else if (e.key === "Escape" && s.selectedIds.length) {
        s.select([]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key in ARROWS) store.getState().endGesture();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store]);
}
