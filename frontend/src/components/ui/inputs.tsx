import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Checkbox as RCheckbox, Select, Slider as RSlider, Tabs as RTabs } from "radix-ui";
import { Check, ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { cn, focusRing } from "../../lib/cn";
import { Spinner } from "./feedback";

const inputBase =
  "w-full rounded-md border border-input bg-app text-fg placeholder:text-muted transition-colors duration-[var(--tk-motion-fast)] " +
  "hover:border-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 " +
  "disabled:bg-surface disabled:text-muted aria-[invalid=true]:border-danger";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string | null;
  hint?: string;
  size?: "sm" | "md";
  hideLabel?: boolean;
  /** A small button inside the box, on the right (e.g. show password). */
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, error, hint, size = "md", hideLabel, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={cn("text-xs text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          className={cn(inputBase, size === "sm" ? "h-8 px-2 text-sm" : "h-10 px-3 text-sm", trailing ? "pr-10" : null)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {(error || hint) && (
        <p id={noteId} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

/** A password box with an eye button that shows or hides what's typed. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type" | "trailing">>(function PasswordField(props, ref) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <TextField
      ref={ref}
      {...props}
      type={shown ? "text" : "password"}
      // stops browsers from offering to autocorrect or spell-check a visible password
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={shown}
          title={shown ? "Hide password" : "Show password"}
          onClick={() => setShown(!shown)}
          className={cn("flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-fg", focusRing)}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      }
    />
  );
});

/**
 * Number input that commits on Enter or blur. ↑/↓ ±1, Shift ±10, Escape reverts.
 * Shows a unit suffix (px, in, ...). Clamping is the caller's job.
 */
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  step = 1,
  decimals = 0,
  error,
  size = "md",
  hideLabel,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  unit?: string;
  step?: number;
  decimals?: number;
  error?: string | null;
  size?: "sm" | "md";
  hideLabel?: boolean;
}) {
  const id = useId();
  const fmt = (v: number) => (Number.isFinite(v) ? String(Number(v.toFixed(decimals))) : "");
  const [text, setText] = useState(fmt(value));
  // show the new value when it changes from outside (e.g. dragging on the canvas)
  useEffect(() => setText(Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : ""), [value, decimals]);
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (Number.isFinite(n) && text.trim() !== "") onCommit(n);
    else setText(fmt(value));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") setText(fmt(value));
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const n = Number(text) || 0;
      const delta = (e.shiftKey ? 10 : 1) * step * (e.key === "ArrowUp" ? 1 : -1);
      const next = Number((n + delta).toFixed(decimals));
      setText(String(next));
      onCommit(next);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={cn("text-xs text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(inputBase, "tabular-nums", size === "sm" ? "h-8 px-2 text-sm" : "h-10 px-3 text-sm", unit && "pr-9")}
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-err`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  loading,
  size = "md",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  loading?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (value) onChange("");
            else e.currentTarget.blur();
          }
        }}
        className={cn(
          inputBase,
          "pl-9 [&::-webkit-search-cancel-button]:hidden",
          size === "sm" ? "h-8 pr-8 text-sm" : "h-10 rounded-pill pr-10 text-sm",
        )}
      />
      <div className="absolute top-1/2 right-2 -translate-y-1/2">
        {loading ? (
          <Spinner className="text-muted" />
        ) : value ? (
          <button type="button" aria-label="Clear search" onClick={() => onChange("")} className={cn("rounded-sm p-1 text-muted hover:text-fg", focusRing)}>
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  hideLabel,
  triggerRef,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  hideLabel?: boolean;
  /** e.g. for a dialog that should open with this field focused */
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label id={id} className={cn("text-xs text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
        <Select.Trigger
          ref={triggerRef}
          aria-labelledby={id}
          className={cn(inputBase, "inline-flex items-center justify-between gap-2", size === "sm" ? "h-8 px-2 text-sm" : "h-10 px-3 text-sm")}
        >
          <span className="min-w-0 truncate">
            <Select.Value />
          </span>
          <Select.Icon>
            <ChevronDown className="size-4 text-muted" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-w-(--radix-select-content-available-width) min-w-(--radix-select-trigger-width) rounded-lg border border-border bg-app p-1 shadow-pop"
          >
            <Select.Viewport>
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="flex h-8 cursor-default items-center justify-between gap-4 rounded-sm px-2 text-sm outline-none select-none data-highlighted:bg-surface-hover"
                >
                  <span className="min-w-0 truncate">
                    <Select.ItemText>{o.label}</Select.ItemText>
                  </span>
                  <Select.ItemIndicator>
                    <Check className="size-4 text-accent" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <RCheckbox.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-app",
          "data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50",
          focusRing,
        )}
      >
        <RCheckbox.Indicator>
          <Check className="size-3 text-on-accent" strokeWidth={3} aria-hidden />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <RSlider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit?.(v)}
        className="relative flex h-5 touch-none items-center select-none data-disabled:opacity-50"
      >
        <RSlider.Track className="relative h-1 grow rounded-pill bg-border">
          <RSlider.Range className="absolute h-full rounded-pill bg-accent" />
        </RSlider.Track>
        <RSlider.Thumb aria-label={label} aria-valuetext={`${value}${unit}`} className={cn("block size-4 rounded-pill border border-input bg-app shadow-card", focusRing)} />
      </RSlider.Root>
    </div>
  );
}

/** Underline tabs (Projects) or segmented tabs (Position panel). */
export const Tabs = {
  Root: RTabs.Root,
  Content: RTabs.Content,
  List({ variant = "underline", label, children }: { variant?: "underline" | "segmented"; label: string; children: React.ReactNode }) {
    return (
      <RTabs.List aria-label={label} className={cn("flex", variant === "underline" ? "gap-4 border-b border-border" : "gap-1 rounded-md bg-surface p-1")}>
        {children}
      </RTabs.List>
    );
  },
  Trigger({ value, variant = "underline", children }: { value: string; variant?: "underline" | "segmented"; children: React.ReactNode }) {
    return (
      <RTabs.Trigger
        value={value}
        className={cn(
          "text-sm text-muted transition-colors hover:text-fg data-[state=active]:text-fg",
          variant === "underline"
            ? "-mb-px border-b-2 border-transparent pb-2 data-[state=active]:border-accent"
            : "flex-1 rounded-sm px-3 py-1 data-[state=active]:bg-app data-[state=active]:shadow-card",
          focusRing,
        )}
      >
        {children}
      </RTabs.Trigger>
    );
  },
};
