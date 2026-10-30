import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { api } from "../data";
import { PX_PER_UNIT, sizeError, type DisplayUnit } from "../lib/document";
import { Button } from "../components/ui/Button";
import { NumberField, SelectField } from "../components/ui/inputs";
import { Popover } from "../components/ui/overlays";
import { toast } from "../components/ui/feedback";

// our own preset list (recon S03)
const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Square post", w: 1080, h: 1080 },
  { label: "Portrait post", w: 1080, h: 1350 },
  { label: "Story", w: 1080, h: 1920 },
  { label: "Slide (16:9)", w: 1920, h: 1080 },
  { label: "A4 document", w: 794, h: 1123 },
];

const UNITS: { value: DisplayUnit; label: string }[] = [
  { value: "px", label: "px" },
  { value: "in", label: "in" },
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
];

/** S03: the "Create a design" popover on Home. */
export function CreateDesign() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<DisplayUnit>("px");
  const [w, setW] = useState(1080);
  const [h, setH] = useState(1080);
  const [busy, setBusy] = useState(false);
  const toPx = (v: number) => Math.round(v * PX_PER_UNIT[unit]);
  const error = sizeError(toPx(w), toPx(h), unit);

  const create = async (widthPx: number, heightPx: number, displayUnit: DisplayUnit) => {
    setBusy(true);
    try {
      // our own id, so a double click can't make two designs
      const d = await api.createDesign({ id: crypto.randomUUID(), width_px: widthPx, height_px: heightPx, display_unit: displayUnit });
      navigate(`/design/${d.id}/edit`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create the design.", { kind: "error" });
      setBusy(false);
    }
  };

  const changeUnit = (next: DisplayUnit) => {
    // keep the same physical size, shown in the new unit
    const k = PX_PER_UNIT[unit] / PX_PER_UNIT[next];
    const round = (v: number) => (next === "px" ? Math.round(v * k) : Number((v * k).toFixed(2)));
    setW(round(w));
    setH(round(h));
    setUnit(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!error) create(toPx(w), toPx(h), unit);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="primary" icon={<Plus className="size-4" aria-hidden />}>
          Create a design
        </Button>
      </Popover.Trigger>
      <Popover.Content label="Create a design" align="end" className="w-80">
        <h2 className="text-sm font-semibold">Pick a size</h2>
        <ul className="mt-2 flex flex-col">
          {PRESETS.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                disabled={busy}
                onClick={() => create(p.w, p.h, "px")}
                className="flex h-9 w-full items-center justify-between rounded-md px-2 text-left text-sm hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none disabled:opacity-50"
              >
                {p.label}
                <span className="text-xs text-muted tabular-nums">
                  {p.w} × {p.h}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="mt-3 border-t border-border pt-3" noValidate>
          <h2 className="text-sm font-semibold">Custom size</h2>
          <div className="mt-2 grid grid-cols-[1fr_1fr_5rem] items-start gap-2">
            <NumberField label="Width" value={w} onCommit={setW} decimals={unit === "px" ? 0 : 2} size="sm" />
            <NumberField label="Height" value={h} onCommit={setH} decimals={unit === "px" ? 0 : 2} size="sm" />
            <SelectField label="Unit" value={unit} options={UNITS} onChange={changeUnit} size="sm" />
          </div>
          {error ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : (
            unit !== "px" && (
              <p className="mt-2 text-xs text-muted">
                = {toPx(w)} × {toPx(h)} px
              </p>
            )
          )}
          <Button type="submit" variant="primary" size="sm" className="mt-3 w-full" loading={busy} disabled={!!error}>
            Create design
          </Button>
        </form>
      </Popover.Content>
    </Popover.Root>
  );
}
