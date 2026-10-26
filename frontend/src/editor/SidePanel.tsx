// S08 SidePanelRail + SidePanel (components.md). Milestone 1 tabs: Text (S10),
// Elements (S09, rectangle only), Uploads (S11). Design and Projects come later.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Tabs as RTabs } from "radix-ui";
import { ImageUp, RotateCw, Shapes, Type } from "lucide-react";
import { api, UPLOAD_MAX_BYTES, UPLOAD_TYPES, type Asset } from "../data";
import { makeImage, makeShape, makeText } from "../lib/document";
import { cn, focusRing } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton, Spinner } from "../components/ui/feedback";
import { useEditor } from "./store";

const TABS = [
  { value: "text", label: "Text", icon: Type },
  { value: "elements", label: "Elements", icon: Shapes },
  { value: "uploads", label: "Uploads", icon: ImageUp },
] as const;

export function SidePanel() {
  return (
    <RTabs.Root defaultValue="text" orientation="vertical" className="flex shrink-0 border-r border-border bg-app">
      <RTabs.List aria-label="Add to your design" className="flex w-(--tk-layout-rail-w) flex-col gap-1 border-r border-border p-1">
        {TABS.map(({ value, label, icon: Icon }) => (
          <RTabs.Trigger
            key={value}
            value={value}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md py-2 text-xs text-muted hover:bg-surface-hover hover:text-fg",
              "data-[state=active]:bg-accent-soft data-[state=active]:text-accent",
              focusRing,
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            {label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      <div className="w-(--tk-layout-panel-w) overflow-y-auto p-4">
        <RTabs.Content value="text" className="outline-none">
          <TextPanel />
        </RTabs.Content>
        <RTabs.Content value="elements" className="outline-none">
          <ElementsPanel />
        </RTabs.Content>
        <RTabs.Content value="uploads" className="outline-none">
          <UploadsPanel />
        </RTabs.Content>
      </div>
    </RTabs.Root>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold">{children}</h2>;
}

function TextPanel() {
  const { width_px: w, height_px: h } = useEditor((s) => s.design);
  const readOnly = useEditor((s) => s.readOnly);
  const add = useEditor((s) => s.addElement);
  return (
    <>
      <PanelTitle>Text</PanelTitle>
      <div className="flex flex-col gap-2">
        {/* each preview in its own size; the span sets it, so the Button's own text size can't win */}
        <Button size="lg" className="justify-start" disabled={readOnly} onClick={() => add(makeText(w, h, "heading"), "Added a heading")}>
          <span className="text-xl">Add a heading</span>
        </Button>
        <Button className="justify-start" disabled={readOnly} onClick={() => add(makeText(w, h, "subheading"), "Added a subheading")}>
          <span className="text-base">Add a subheading</span>
        </Button>
        <Button className="justify-start" disabled={readOnly} onClick={() => add(makeText(w, h, "body"), "Added body text")}>
          <span className="font-normal">Add some body text</span>
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted">Editing the words on the page comes in the next milestone.</p>
    </>
  );
}

function ElementsPanel() {
  const { width_px: w, height_px: h } = useEditor((s) => s.design);
  const readOnly = useEditor((s) => s.readOnly);
  const add = useEditor((s) => s.addElement);
  return (
    <>
      <PanelTitle>Elements</PanelTitle>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => add(makeShape(w, h, "rect"), "Added a rectangle")}
        aria-label="Add a rectangle"
        className={cn("flex size-20 items-center justify-center rounded-md bg-surface hover:bg-surface-hover disabled:opacity-50", focusRing)}
      >
        <span aria-hidden className="block size-12 rounded-sm bg-muted" />
      </button>
    </>
  );
}

/** Reads an image's size in the browser (the server only checks bytes and type). */
async function imageSize(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width_px: bitmap.width, height_px: bitmap.height };
  bitmap.close();
  return size;
}

function UploadsPanel() {
  const { width_px: w, height_px: h } = useEditor((s) => s.design);
  const readOnly = useEditor((s) => s.readOnly);
  const add = useEditor((s) => s.addElement);
  const addAssetUrl = useEditor((s) => s.addAssetUrl);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setAssets(await api.listAssets());
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (files: FileList) => {
    setErrors([]);
    for (const file of Array.from(files)) {
      if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) {
        setErrors((e) => [...e, `${file.name}: use a PNG, JPG or WebP image.`]);
        continue;
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        setErrors((e) => [...e, `${file.name}: that's over 25 MB.`]);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const asset = await api.uploadAsset(file, await imageSize(file), crypto.randomUUID());
        setAssets((list) => [asset, ...(list ?? [])]);
      } catch (err) {
        setErrors((e) => [...e, `${file.name}: ${err instanceof Error ? err.message : "the upload failed. Try again."}`]);
      } finally {
        setUploading((u) => u.filter((name) => name !== file.name));
      }
    }
  };

  const place = (a: Asset) => {
    addAssetUrl(a.id, a.url);
    add(makeImage(w, h, a.id, a.width_px, a.height_px), `Added ${a.original_name ?? "an image"}`);
  };

  return (
    <>
      <PanelTitle>Uploads</PanelTitle>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose images to upload"
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <Button variant="primary" className="w-full" disabled={readOnly} onClick={() => input.current?.click()}>
        Upload images
      </Button>
      <p className="mt-2 text-xs text-muted">PNG, JPG or WebP, up to 25 MB each.</p>

      <div aria-live="polite" className="mt-3 flex flex-col gap-1 empty:hidden">
        {uploading.map((name) => (
          <p key={name} className="flex items-center gap-2 text-sm">
            <Spinner /> Uploading {name}…
          </p>
        ))}
      </div>
      {errors.length > 0 && (
        <div role="alert" className="mt-3 flex flex-col gap-1 rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div className="mt-4">
        {failed ? (
          <EmptyState icon={<RotateCw />} title="Couldn't load your uploads" action={<Button onClick={load}>Try again</Button>} />
        ) : assets === null ? (
          <div className="grid grid-cols-3 gap-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState icon={<ImageUp />} title="No uploads yet" body="Your photos and images will show up here." />
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {assets.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => place(a)}
                  aria-label={`Add ${a.original_name ?? "image"} to the page`}
                  className={cn("flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface hover:shadow-card disabled:opacity-50", focusRing)}
                >
                  {/* same crossOrigin as the canvas, so the browser's cached copy stays usable for export */}
                  <img src={a.url} alt="" crossOrigin="anonymous" className="max-h-full max-w-full object-contain" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
