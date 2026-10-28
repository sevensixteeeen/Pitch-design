// Turning pages into files: PNG / JPG of one page, PDF of chosen pages (each page as a picture).
// Everything happens in the browser; nothing is uploaded (architecture.md: no export jobs).
import type { ExportPage } from "./Canvas";

export type FileType = "png" | "jpg" | "pdf";

/** "Spring sale: poster!" -> "Spring sale poster.png" (or "… - page 2.png") */
export function fileName(title: string, type: FileType, page?: number) {
  const clean = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "design";
  return `${clean}${page === undefined ? "" : ` - page ${page}`}.${type}`;
}

export function saveFile(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

/** Lets the browser draw the "Preparing…" state between pages of a long PDF. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A PDF with one page per chosen design page, at the design's size (96 px = 1 inch = 72 points).
 * Pages are JPEG pictures for now; a PDF with real, selectable text is planned for milestone 4.
 */
export async function buildPdf(exportPage: ExportPage, pages: number[], widthPx: number, heightPx: number, title: string): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib"); // loaded only when someone downloads a PDF
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("Pitch");
  const w = (widthPx * 72) / 96;
  const h = (heightPx * 72) / 96;
  for (const i of pages) {
    const bytes = await fetch(exportPage(i, "image/jpeg", 0.92)).then((r) => r.arrayBuffer());
    const image = await doc.embedJpg(bytes);
    doc.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
    await breathe();
  }
  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}
