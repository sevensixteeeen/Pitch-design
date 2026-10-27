// S14 ColorPicker / Swatch (components.md). Document colours, a default set, "none" where it makes
// sense, the system colour picker for anything else, and a hex field.
// The swatch colours are design data (what goes into the document), not UI colours.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ban } from "lucide-react";
import type { Hex } from "../lib/document";
import { cn, focusRing } from "../lib/cn";
import { Popover } from "../components/ui/overlays";
import { documentColours } from "./commands";
import { useEditor } from "./store";

const DEFAULTS: { hex: Hex; name: string }[] = [
  { hex: "#15181d", name: "Ink" },
  { hex: "#ffffff", name: "White" },
  { hex: "#9aa3ad", name: "Grey" },
  { hex: "#e03131", name: "Red" },
  { hex: "#f08c00", name: "Orange" },
  { hex: "#fcc419", name: "Yellow" },
  { hex: "#2f9e44", name: "Green" },
  { hex: "#0c8599", name: "Teal" },
  { hex: "#1c7ed6", name: "Blue" },
  { hex: "#7048e8", name: "Violet" },
  { hex: "#d6336c", name: "Pink" },
  { hex: "#8d5524", name: "Brown" },
];

export interface ColorPickerProps {
  label: string;
  value: Hex | null;
  allowNone?: boolean;
  /** a swatch, the hex field or "none": one undo step */
  onPick: (color: Hex | null) => void;
  /** the system colour picker while it's open: live, one undo step in total */
  onLive: (color: Hex) => void;
  onLiveEnd: () => void;
}

function Swatch({ hex, name, current, onPick }: { hex: Hex; name: string; current: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${name} ${hex.toUpperCase()}`}
      aria-pressed={current}
      onClick={onPick}
      className={cn("size-7 rounded-pill border border-input transition-transform hover:scale-108", current && "ring-2 ring-fg ring-offset-2 ring-offset-app", focusRing)}
      style={{ background: hex }}
    />
  );
}

export function ColorPicker({ label, value, allowNone, onPick, onLive, onLiveEnd }: ColorPickerProps) {
  const content = useEditor((s) => s.content);
  const used = useMemo(() => documentColours(content), [content]);
  const [hex, setHex] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const system = useRef<HTMLInputElement>(null);
  useEffect(() => setHex(value ?? ""), [value]);

  // the native "change" event fires once, when the system picker closes
  useEffect(() => {
    const el = system.current;
    if (!el) return;
    el.addEventListener("change", onLiveEnd);
    return () => el.removeEventListener("change", onLiveEnd);
  }, [onLiveEnd]);

  const commitHex = () => {
    const v = hex.trim().replace(/^#?/, "#").toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) {
      setError(null);
      if (v !== value) onPick(v);
    } else {
      setError("Use 6 hex digits, like #1C7ED6.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{label}</h3>
      {used.length > 0 && (
        <section aria-label="Colours in this design">
          <p className="mb-1 text-xs text-muted">In this design</p>
          <div className="flex flex-wrap gap-2">
            {used.map((c) => (
              <Swatch key={c} hex={c} name="Design colour" current={c === value} onPick={() => onPick(c)} />
            ))}
          </div>
        </section>
      )}
      <section aria-label="Default colours">
        <p className="mb-1 text-xs text-muted">Default colours</p>
        <div className="flex flex-wrap gap-2">
          {allowNone && (
            <button
              type="button"
              aria-label="No colour"
              aria-pressed={value === null}
              onClick={() => onPick(null)}
              className={cn("flex size-7 items-center justify-center rounded-pill border border-input bg-app text-muted", value === null && "ring-2 ring-fg ring-offset-2 ring-offset-app", focusRing)}
            >
              <Ban className="size-4" aria-hidden />
            </button>
          )}
          {DEFAULTS.map((d) => (
            <Swatch key={d.hex} hex={d.hex} name={d.name} current={d.hex === value} onPick={() => onPick(d.hex)} />
          ))}
        </div>
      </section>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Custom
          <input
            ref={system}
            type="color"
            value={value ?? "#000000"}
            onChange={(e) => onLive(e.target.value)}
            className={cn("h-8 w-10 cursor-pointer rounded-md border border-input bg-app p-0.5", focusRing)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs">
          Hex
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => e.key === "Enter" && commitHex()}
            aria-invalid={!!error}
            aria-describedby={error ? "hex-error" : undefined}
            spellCheck={false}
            className={cn("h-8 rounded-md border border-input bg-app px-2 font-mono text-sm uppercase", error && "border-danger", focusRing)}
          />
        </label>
      </div>
      {error && (
        <p id="hex-error" role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A colour chip in a toolbar that opens the picker. */
export function ColorButton(props: ColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${props.label}: ${props.value ? props.value.toUpperCase() : "none"}`}
          className={cn("flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-surface-hover", focusRing)}
        >
          {props.value ? (
            <span aria-hidden className="size-5 rounded-pill border border-input" style={{ background: props.value }} />
          ) : (
            <Ban aria-hidden className="size-4 text-muted" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content label={props.label} align="center" className="w-72">
        <ColorPicker {...props} />
      </Popover.Content>
    </Popover.Root>
  );
}
