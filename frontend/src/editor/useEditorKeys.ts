// Keyboard shortcuts for the editor (components.md: SelectionBox keys, ZoomControl keys).
// Ignored while typing in a field; plain keys (arrows, Delete, Escape) are also left to menus,
// sliders, tabs and toolbars, which use them for their own navigation.
import { useEffect } from "react";
import { deleteSelection, duplicateSelection, groupSelection, moveLayers, nudgeSelection, selectAll, styleText, ungroupSelection } from "./commands";
import { copySelection, cutSelection, hasClipboard, paste } from "./clipboard";
import { activeElements, stepZoom, type EditorStore } from "./store";

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
        // copy / cut / paste only take over when there's something of ours to act on;
        // otherwise the browser keeps its usual job
        else if (key === "c" && !inWidget && s.selectedIds.length) run(() => copySelection(store));
        else if (key === "x" && !inWidget && s.selectedIds.length && !s.readOnly) run(() => cutSelection(store));
        else if (key === "v" && !inWidget && hasClipboard() && !s.readOnly) run(() => paste(store));
        else if (key === "=" || key === "+") run(() => s.setZoom(stepZoom(s.view, 1)));
        else if (key === "-") run(() => s.setZoom(stepZoom(s.view, -1)));
        else if (key === "0") run(() => s.setZoom("fit"));
        else if (key === "]" || key === "}") run(() => moveLayers(store, e.shiftKey ? "front" : "forward"));
        else if (key === "[" || key === "{") run(() => moveLayers(store, e.shiftKey ? "back" : "backward"));
        else if (key === "g" && e.shiftKey) run(() => ungroupSelection(store));
        else if (key === "g") run(() => groupSelection(store));
        else if ((key === "b" || key === "i" || key === "u") && !e.shiftKey) {
          // bold / italic / underline for the selected text (left to the browser when no text is selected)
          const texts = activeElements(s).filter((el) => el.type === "text" && s.selectedIds.includes(el.id));
          const field = ({ b: "bold", i: "italic", u: "underline" } as const)[key];
          if (texts.length) run(() => void styleText(store, { [field]: !texts.every((t) => t.type === "text" && t[field]) }));
        }
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
      } else if (e.key === "Enter" && target?.closest("[data-canvas]") && s.selectedIds.length === 1 && !s.readOnly) {
        // Enter on the canvas types into the selected text box (Enter elsewhere keeps its usual job)
        const el = activeElements(s).find((x) => x.id === s.selectedIds[0]);
        if (el?.type === "text" && !el.locked) {
          e.preventDefault();
          s.setEditing(el.id);
        }
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
