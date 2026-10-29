import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Tooltip } from "radix-ui";
import { cn, focusRing } from "../../lib/cn";
import { Spinner } from "./feedback";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-app text-fg border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-fg hover:bg-surface-hover",
  danger: "bg-danger text-on-danger hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm font-semibold gap-2",
  lg: "h-12 px-6 text-base font-semibold gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

/** The button look, for a link that should look like a button (e.g. <Link className={buttonStyles()}>). */
export function buttonStyles({ variant = "secondary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md transition-colors duration-[var(--tk-motion-fast)] active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
  pressed?: boolean;
  children: ReactNode;
}

/**
 * Icon-only button. The label is both the accessible name and the tooltip. The tooltip only shows
 * the name on screen, so it's hidden from screen readers (they'd hear the name twice) and its
 * shortcut is announced through aria-keyshortcuts instead (BUG-009).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, size = "md", pressed, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          type={type}
          aria-label={label}
          aria-keyshortcuts={shortcut?.replaceAll("Ctrl", "Control")}
          // Radix points this at the open tooltip, which repeats the label
          aria-describedby={undefined}
          aria-pressed={pressed}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md text-fg transition-colors duration-[var(--tk-motion-fast)]",
            "hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50",
            pressed && "bg-accent-soft text-accent hover:bg-accent-soft",
            size === "sm" ? "size-7 [&_svg]:size-4" : "size-9 [&_svg]:size-5",
            focusRing,
            className,
          )}
          {...rest}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          aria-hidden
          sideOffset={6}
          className="z-50 rounded-sm bg-inverse px-2 py-1 text-xs text-on-inverse shadow-pop"
        >
          {label}
          {shortcut && <span className="ml-2 opacity-70">{shortcut}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
