// S08 TopBar (components.md): Home, undo / redo, title, save status, Download (S20).
// File menu, rename in place and Resize come in later milestones.
import type { RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, Check, Home, Redo2, Undo2 } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Spinner } from "../components/ui/feedback";
import type { ExportPage } from "./Canvas";
import { DownloadPanel } from "./DownloadPanel";
import { useEditor, useEditorStore, type SaveState } from "./store";

function SaveStatus({ save, readOnly }: { save: SaveState; readOnly: boolean }) {
  const navigate = useNavigate();
  const content = (() => {
    if (readOnly) return <span className="text-muted">In Trash: read only</span>;
    switch (save.kind) {
      case "saved":
        return (
          <span className="flex items-center gap-1 text-muted">
            <Check className="size-4" aria-hidden /> Saved
          </span>
        );
      case "saving":
        return (
          <span className="flex items-center gap-1 text-muted">
            <Spinner /> Saving…
          </span>
        );
      case "retrying":
        return (
          <span className="flex items-center gap-1 text-warning">
            <AlertTriangle className="size-4" aria-hidden /> Reconnecting…
          </span>
        );
      case "conflict":
        return (
          <span className="flex items-center gap-2 text-danger">
            Changed in another tab
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </span>
        );
      case "gone":
        return <span className="text-danger">Not saved: this design was deleted or moved to Trash</span>;
      case "signed-out":
        return (
          <span className="flex items-center gap-2 text-danger">
            Not saved: you're logged out
            <Button size="sm" onClick={() => navigate("/login")}>
              Log in
            </Button>
          </span>
        );
      case "refused":
        return <span className="text-danger">Not saved: {save.message}</span>;
    }
  })();
  return (
    <div aria-live="polite" className="text-sm">
      {content}
    </div>
  );
}

export function TopBar({ exportRef }: { exportRef: RefObject<ExportPage | null> }) {
  const title = useEditor((s) => s.design.title);
  const save = useEditor((s) => s.save);
  const readOnly = useEditor((s) => s.readOnly);
  const canUndo = useEditor((s) => !s.readOnly && s.past.length > 0);
  const canRedo = useEditor((s) => !s.readOnly && s.future.length > 0);
  const store = useEditorStore();
  const navigate = useNavigate();
  return (
    <header className="flex h-(--tk-layout-topbar-h) shrink-0 items-center gap-3 border-b border-border bg-app px-3">
      <IconButton label="Home" onClick={() => navigate("/")}>
        <Home strokeWidth={1.75} aria-hidden />
      </IconButton>
      <div className="flex items-center gap-1">
        <IconButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => store.getState().undo()}>
          <Undo2 strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => store.getState().redo()}>
          <Redo2 strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>
      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold" title={title}>
        {title}
      </h1>
      <SaveStatus save={save} readOnly={readOnly} />
      <DownloadPanel exportRef={exportRef} />
    </header>
  );
}

/** Below the editor's minimum width (layout.editor-min-w): a short note instead. */
export function SmallScreenNote() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg">Open this on a larger screen</h1>
      <p className="max-w-80 text-sm text-muted">The editor needs a wider window, like a laptop or desktop screen.</p>
      <Link to="/" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
