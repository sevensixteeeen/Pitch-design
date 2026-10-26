/** Join class names, skipping empty ones. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** The focus ring every interactive part uses (components.md, ground rules). */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app";
