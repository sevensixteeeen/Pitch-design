// Copy, cut and paste inside Pitch. The clipboard lives in this browser tab and is shared by every
// design opened in it, so you can copy from one design and paste into another. Photos bring their
// links along, so they show straight away in the other design.
import { assetIds, cloneElement, type Element } from "../lib/document";
import { deleteSelection } from "./commands";
import { activePage, type EditorStore } from "./store";

const OFFSET = 20; // px a paste lands down and to the right of what's already there

interface Clip {
  elements: Element[]; // in drawing order (back first)
  assetUrls: Record<string, string>;
  fromPage: string; // pasting back onto this page offsets each paste so copies don't stack exactly
  pastes: number;
}

let clip: Clip | null = null;

export const hasClipboard = () => clip !== null;

const count = (n: number) => (n === 1 ? "1 element" : `${n} elements`);

export function copySelection(store: EditorStore): boolean {
  const s = store.getState();
  const page = activePage(s);
  const elements = page.elements.filter((el) => s.selectedIds.includes(el.id));
  if (elements.length === 0) return false;
  const ids = assetIds({ schema_version: 1, pages: [{ ...page, elements }] });
  clip = {
    elements: structuredClone(elements),
    assetUrls: Object.fromEntries(ids.filter((id) => s.assetUrls[id]).map((id) => [id, s.assetUrls[id]])),
    fromPage: page.id,
    pastes: 0,
  };
  s.setAnnouncement(`Copied ${count(elements.length)}`);
  return true;
}

/** Copy, then delete (locked elements are copied but stay, like Delete). */
export function cutSelection(store: EditorStore): boolean {
  if (!copySelection(store)) return false;
  deleteSelection(store);
  return true;
}

export function paste(store: EditorStore): boolean {
  const s = store.getState();
  if (!clip || s.readOnly) return false;
  clip.pastes += 1;
  const offset = OFFSET * (activePage(s).id === clip.fromPage ? clip.pastes : clip.pastes - 1);
  const copies = clip.elements.map((el) => ({ ...cloneElement(el), x: el.x + offset, y: el.y + offset, locked: false }) as Element);
  for (const [id, url] of Object.entries(clip.assetUrls)) if (!s.assetUrls[id]) s.addAssetUrl(id, url);
  s.change((els) => [...els, ...copies], { select: copies.map((c) => c.id), announcement: `Pasted ${count(copies.length)}` });
  return true;
}
