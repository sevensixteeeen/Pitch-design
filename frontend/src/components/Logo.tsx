// Pitch's logo (replica/brand.md): a bold P in a rounded square with a marigold spark, an idea being
// pitched. Colours come from the tokens, so the mark follows the palette. The wordmark is "pitch" in
// lowercase, in the display font. public/favicon.svg is the same mark with the colours written in.
import { cn } from "../lib/cn";

/** The mark on its own. Decorative unless `label` is given (then it's an image named `label`). */
export function LogoMark({ size = 32, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <rect width="64" height="64" rx="16" fill="var(--tk-color-accent)" />
      <path
        fill="var(--tk-color-on-accent)"
        fillRule="evenodd"
        d="M23 14h10a12 12 0 0 1 0 24h-6v8a4 4 0 0 1-8 0V18a4 4 0 0 1 4-4Zm4 8v8h6a4 4 0 0 0 0-8h-6Z"
      />
      <circle cx="49" cy="15" r="4.5" fill="var(--tk-color-spark)" />
    </svg>
  );
}

/** Mark and name together. The name is real text, so screen readers read "pitch". */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="font-display font-bold tracking-tight text-fg" style={{ fontSize: size * 0.78, lineHeight: 1 }}>
        pitch
      </span>
    </span>
  );
}
