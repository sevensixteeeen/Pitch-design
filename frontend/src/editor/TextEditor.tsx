// Typing on the canvas (S08, "edit text in place"): a text area laid exactly over the text box,
// with the same font, size, spacing, rotation and zoom. Escape, Ctrl+Enter or clicking elsewhere
// finishes; the change is one undo step. Enter makes a new line.
import { useLayoutEffect, useRef } from "react";
import type { TextElement } from "../lib/document";

export function TextEditor({ el, left, top, scale, onDone }: { el: TextElement; left: number; top: number; scale: number; onDone: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone(ref.current?.value ?? el.text);
  };
  // grow with the text, like the box on the canvas will
  const fit = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "0px";
    t.style.height = `${t.scrollHeight}px`;
  };
  useLayoutEffect(() => {
    fit();
    ref.current?.focus({ preventScroll: true });
    ref.current?.select();
  }, []);

  const width = el.width * scale;
  const height = el.height * scale;
  return (
    <textarea
      ref={ref}
      defaultValue={el.text}
      aria-label="Edit text. Escape to finish."
      maxLength={10_000}
      onInput={fit}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          finish();
        }
      }}
      className="absolute z-10 m-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre-wrap ring-1 ring-selection"
      // position, size and type come from the element (design data), scaled to the zoom
      style={{
        left,
        top,
        width,
        minHeight: height,
        fontFamily: `"${el.font_family}"`,
        fontSize: el.font_size * scale,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none",
        lineHeight: el.line_height,
        letterSpacing: el.letter_spacing * scale,
        color: el.color,
        textAlign: el.align,
        opacity: el.opacity,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: `${width / 2}px ${height / 2}px`,
      }}
    />
  );
}
