// S20 Download panel (components.md, Popover): file type, page or pages, JPG quality.
// States: default, preparing, failed. Done closes the panel.
import { useState, type RefObject } from "react";
import { Download } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Checkbox, SelectField, Slider } from "../components/ui/inputs";
import { Popover } from "../components/ui/overlays";
import type { ExportPage } from "./Canvas";
import { buildPdf, fileName, saveFile, type FileType } from "./exportFile";
import { useEditor } from "./store";

const TYPES: { value: FileType; label: string }[] = [
  { value: "png", label: "PNG (sharp, good for graphics)" },
  { value: "jpg", label: "JPG (smaller, good for photos)" },
  { value: "pdf", label: "PDF (all or chosen pages)" },
];

export function DownloadPanel({ exportRef }: { exportRef: RefObject<ExportPage | null> }) {
  const design = useEditor((s) => s.design);
  const pageCount = useEditor((s) => s.content.pages.length);
  const activePage = useEditor((s) => s.activePage);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FileType>("png");
  const [page, setPage] = useState(activePage);
  const [quality, setQuality] = useState(90);
  const [chosen, setChosen] = useState<number[] | null>(null); // null = all pages
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = Array.from({ length: pageCount }, (_, i) => i);
  const pdfPages = (chosen ?? all).filter((i) => i < pageCount);
  const multi = pageCount > 1;

  const onOpenChange = (next: boolean) => {
    if (busy) return; // stays open while the file is being made
    if (next) {
      setPage(activePage); // start from the page being edited
      setError(null);
    }
    setOpen(next);
  };

  const download = async () => {
    const exportPage = exportRef.current;
    if (!exportPage) return;
    setBusy(true);
    setError(null);
    try {
      if (type === "pdf") {
        const blob = await buildPdf(exportPage, pdfPages, design.width_px, design.height_px, design.title);
        const url = URL.createObjectURL(blob);
        saveFile(url, fileName(design.title, "pdf"));
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } else {
        const url = exportPage(page, type === "png" ? "image/png" : "image/jpeg", quality / 100);
        saveFile(url, fileName(design.title, type, multi ? page + 1 : undefined));
      }
      setOpen(false);
    } catch (err) {
      // a "tainted" canvas (an image that refused cross-site use) lands here too
      console.warn("download failed", err);
      setError("Couldn't make the file. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <Button variant="primary" size="sm" icon={<Download className="size-4" aria-hidden />}>
          Download
        </Button>
      </Popover.Trigger>
      <Popover.Content label="Download" align="end" className="flex w-80 flex-col gap-4">
        <h2 className="text-sm font-semibold">Download</h2>
        <SelectField label="File type" value={type} options={TYPES} onChange={setType} size="sm" />

        {type !== "pdf" && multi && (
          <SelectField
            label="Page"
            value={String(page)}
            options={all.map((i) => ({ value: String(i), label: `Page ${i + 1}` }))}
            onChange={(v) => setPage(Number(v))}
            size="sm"
          />
        )}

        {type === "jpg" && <Slider label="Quality" min={10} max={100} step={5} unit="%" value={quality} onChange={setQuality} />}

        {type === "pdf" && multi && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs">Pages</legend>
            <Checkbox label="All pages" checked={chosen === null} onChange={(v) => setChosen(v ? null : [])} />
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pl-6">
              {all.map((i) => (
                <Checkbox
                  key={i}
                  label={`Page ${i + 1}`}
                  checked={pdfPages.includes(i)}
                  onChange={(v) => {
                    const next = v ? [...pdfPages, i].sort((a, b) => a - b) : pdfPages.filter((x) => x !== i);
                    setChosen(next.length === pageCount ? null : next);
                  }}
                />
              ))}
            </div>
          </fieldset>
        )}

        {type === "pdf" && <p className="text-xs text-muted">Each page is saved as a picture, so text in the PDF can't be selected yet.</p>}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button variant="primary" loading={busy} disabled={type === "pdf" && pdfPages.length === 0} onClick={download}>
          {busy ? "Preparing…" : type === "pdf" ? `Download ${pdfPages.length === 1 ? "1 page" : `${pdfPages.length} pages`}` : "Download"}
        </Button>
      </Popover.Content>
    </Popover.Root>
  );
}
