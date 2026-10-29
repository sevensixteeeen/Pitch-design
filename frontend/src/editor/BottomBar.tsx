// S08 BottomBar (components.md, ZoomControl): page counter, the pages grid view (S18) and zoom.
import { LayoutGrid, Minus, Plus } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Menu } from "../components/ui/overlays";
import { stepZoom, useEditor, useEditorStore } from "./store";

const PRESETS = [0.5, 1, 2];

export function BottomBar() {
  const store = useEditorStore();
  const view = useEditor((s) => s.view);
  const zoom = useEditor((s) => s.zoom);
  const pages = useEditor((s) => s.content.pages.length);
  const current = useEditor((s) => s.activePage + 1);
  const percent = Math.round(view.scale * 100);
  const setZoom = (z: "fit" | number) => store.getState().setZoom(z);
  const grid = useEditor((s) => s.pageGrid);

  return (
    <footer className="flex h-(--tk-layout-bottombar-h) shrink-0 items-center gap-1 border-t border-border bg-app px-3">
      <p className="text-xs text-muted">
        Page {current} of {pages}
      </p>
      <IconButton label="Grid view" pressed={grid} size="sm" className="mr-auto ml-1" data-grid-toggle onClick={() => store.getState().setPageGrid(!grid)}>
        <LayoutGrid strokeWidth={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Zoom out" shortcut="Ctrl+-" size="sm" disabled={view.scale <= view.min + 0.001} onClick={() => setZoom(stepZoom(view, -1))}>
        <Minus strokeWidth={1.75} aria-hidden />
      </IconButton>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="ghost" size="sm" className="w-16 tabular-nums" aria-label={`Zoom: ${percent} percent${zoom === "fit" ? ", fitted to the window" : ""}. Change zoom`}>
            {percent}%
          </Button>
        </Menu.Trigger>
        <Menu.Content align="end">
          <Menu.Item onSelect={() => setZoom("fit")} shortcut="Ctrl+0">
            Fit to window
          </Menu.Item>
          {PRESETS.filter((z) => z >= view.min && z <= view.max).map((z) => (
            <Menu.Item key={z} onSelect={() => setZoom(z)}>
              {z * 100}%
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
      <IconButton label="Zoom in" shortcut="Ctrl+=" size="sm" disabled={view.scale >= view.max - 0.001} onClick={() => setZoom(stepZoom(view, 1))}>
        <Plus strokeWidth={1.75} aria-hidden />
      </IconButton>
    </footer>
  );
}
