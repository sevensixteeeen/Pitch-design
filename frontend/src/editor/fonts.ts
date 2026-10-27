// The curated, open-licence fonts (SIL Open Font License), served by this app itself:
// no requests to Google from users' browsers (architecture.md, "Fonts").
// Inter is loaded for the whole app in main.tsx.
import "@fontsource-variable/montserrat";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/lora";
import "@fontsource-variable/oswald";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/caveat";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/400-italic.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/700-italic.css";
import "@fontsource/bebas-neue";

/** `family` is what designs store (the CSS family name); `label` is what people see. */
export const FONTS = [
  { family: "Inter Variable", label: "Inter" },
  { family: "Montserrat Variable", label: "Montserrat" },
  { family: "Poppins", label: "Poppins" },
  { family: "Space Grotesk Variable", label: "Space Grotesk" },
  { family: "Playfair Display Variable", label: "Playfair Display" },
  { family: "Lora Variable", label: "Lora" },
  { family: "Oswald Variable", label: "Oswald" },
  { family: "Bebas Neue", label: "Bebas Neue" },
  { family: "Caveat Variable", label: "Caveat" },
] as const;

export function fontLabel(family: string): string {
  return FONTS.find((f) => f.family === family)?.label ?? family;
}

/**
 * Waits until these fonts (regular and bold) can be drawn. The canvas measures and draws text
 * with whatever font is ready at that moment and doesn't redraw when a font arrives later.
 * Gives up after `timeoutMs`, so a missing font never blocks the editor.
 */
export async function loadFonts(families: string[], timeoutMs = 4000): Promise<void> {
  const wanted = [...new Set(families)].flatMap((f) => [`400 16px "${f}"`, `700 16px "${f}"`]);
  const loads = Promise.all(wanted.map((spec) => document.fonts.load(spec).catch(() => [])));
  await Promise.race([loads, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
