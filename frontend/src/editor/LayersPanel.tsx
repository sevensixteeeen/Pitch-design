// S13 Layers: every element on the page, top first. Click a row to select it (Shift adds to the
// selection), lock it with its own button, and change the drawing order by dragging a row or with
// Alt+↑ / Alt+↓ on it. A group is one row.
import { useState, type DragEvent, type KeyboardEvent } from "react";
import { Circle, GripVertical, Group, Image, Lock, LockOpen, Minus, MoveRight, Square, Triangle, Type } from "lucide-react";
import type { Element } from "../lib/document";
import { cn, focusRing } from "../lib/cn";
import { IconButton } from "../components/ui/Button";
import { describeElement, moveLayerTo, toggleLock } from "./commands";
import { activeElements, useEditor, useEditorStore } from "./store";

function LayerIcon({ el }: { el: Element }) {
  const Icon =
    el.type === "text"
      ? Type
      : el.type === "image"
        ? Image
        : el.type === "group"
          ? Group
          : el.type === "line"
            ? el.arrow_start || el.arrow_end
              ? MoveRight
              : Minus
            : { rect: Square, ellipse: Circle, triangle: Triangle }[el.kind];
  return <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />;
}

export function LayersPanel() {
  const store = useEditorStore();
  const elements = useEditor(activeElements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const readOnly = useEditor((s) => s.readOnly);
  const pageNumber = useEditor((s) => s.activePage + 1);
  const [dragging, setDragging] = useState<string | null>(null);
  // where a dragged row would land in the list below: before row i (rows.length = after the last)
  const [dropAt, setDropAt] = useState<number | null>(null);
  const rows = [...elements].reverse(); // top first
  const n = rows.length;

  /** Drawing-order index (0 = back) of the element at list position `t` (0 = top) once it's moved there. */
  const toIndex = (t: number) => n - 1 - t;

  const onDragOver = (e: DragEvent<HTMLLIElement>, i: number) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const box = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < box.top + box.height / 2 ? i : i + 1);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragging !== null && dropAt !== null) {
      const from = rows.findIndex((el) => el.id === dragging);
      const t = dropAt > from ? dropAt - 1 : dropAt;
      moveLayerTo(store, dragging, toIndex(t));
    }
    setDragging(null);
    setDropAt(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, el: Element, i: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || readOnly) return;
    e.preventDefault();
    e.stopPropagation(); // the editor would otherwise nudge the selection
    const t = e.key === "ArrowUp" ? i - 1 : i + 1;
    if (t >= 0 && t < n) moveLayerTo(store, el.id, toIndex(t));
  };

  return (
    <>
      <h2 className="mb-3 text-base font-semibold">Layers</h2>
      {n === 0 ? (
        <p className="text-sm text-muted">Nothing on page {pageNumber} yet. What you add shows up here, top layer first.</p>
      ) : (
        <>
          <ul aria-label={`Layers on page ${pageNumber}, top first`} className="flex flex-col gap-1" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}>
            {rows.map((el, i) => {
              const selected = selectedIds.includes(el.id);
              const name = describeElement(el);
              return (
                <li
                  key={el.id}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    setDragging(el.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", name);
                  }}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={onDrop}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropAt(null);
                  }}
                  className={cn("relative", dragging === el.id && "opacity-50")}
                >
                  {dropAt === i && <div aria-hidden className="absolute inset-x-0 -top-1 h-0.5 rounded-full bg-accent" />}
                  {dropAt === n && i === n - 1 && <div aria-hidden className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-accent" />}
                  <div className={cn("flex items-center gap-2 rounded-md border pr-1 pl-2", selected ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-hover")}>
                    {!readOnly && <GripVertical className="size-4 shrink-0 cursor-grab text-muted" aria-hidden />}
                    <LayerIcon el={el} />
                    <button
                      type="button"
                      aria-pressed={selected}
                      title={name}
                      onClick={(e) => (e.shiftKey ? store.getState().toggleSelect(el.id) : store.getState().select([el.id]))}
                      onKeyDown={(e) => onKeyDown(e, el, i)}
                      className={cn("min-w-0 flex-1 truncate rounded-sm py-2 text-left text-sm", selected && "font-semibold text-accent", focusRing)}
                    >
                      {name}
                    </button>
                    {!readOnly && (
                      <IconButton label={el.locked ? `Unlock ${name}` : `Lock ${name}`} pressed={el.locked} size="sm" onClick={() => toggleLock(store, [el.id])}>
                        {el.locked ? <Lock strokeWidth={1.75} aria-hidden /> : <LockOpen strokeWidth={1.75} aria-hidden />}
                      </IconButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!readOnly && <p className="mt-3 text-xs text-muted">Drag a layer up or down to change what's in front. With the keyboard: Alt+↑ or Alt+↓ on a layer.</p>}
        </>
      )}
    </>
  );
}
