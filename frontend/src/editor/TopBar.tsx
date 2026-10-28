// S08 TopBar (components.md): Home, File menu, undo / redo, title (click to rename), save status,
// Download (S20). Resize (S22) comes in milestone 4.
import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { AlertTriangle, Check, Home, Redo2, Undo2 } from "lucide-react";
import { api } from "../data";
import { cn, focusRing } from "../lib/cn";
import { Button, IconButton } from "../components/ui/Button";
import { Spinner, toast } from "../components/ui/feedback";
import { Menu } from "../components/ui/overlays";
import type { ExportPage } from "./Canvas";
import { DownloadPanel } from "./DownloadPanel";
import { useEditor, useEditorStore, type SaveState } from "./store";

const TITLE_MAX = 255;

/** The design's title; click (or File → Rename) to type a new one. Enter or clicking away saves, Escape cancels. */
function Title({ renaming, setRenaming }: { renaming: boolean; setRenaming: (v: boolean) => void }) {
  const store = useEditorStore();
  const title = useEditor((s) => s.design.title);
  const readOnly = useEditor((s) => s.readOnly);
  const done = useRef(false);

  const finish = async (value: string | null) => {
    if (done.current) return; // Enter and the blur that follows both land here
    done.current = true;
    setRenaming(false);
    const clean = value?.trim() ?? "";
    if (value === null || !clean || clean === title) return; // cancelled, empty or unchanged: keep the old title
    const s = store.getState();
    s.setTitle(clean);
    try {
      await api.updateDesign(s.design.id, { title: clean });
    } catch (err) {
      s.setTitle(title);
      toast(err instanceof Error ? err.message : "Couldn't rename it. Try again.", { kind: "error" });
    }
  };

  if (renaming) {
    return (
      <input
        aria-label="Design title"
        defaultValue={title}
        maxLength={TITLE_MAX}
        ref={(el) => {
          if (el && document.activeElement !== el) {
            done.current = false;
            el.focus();
            el.select();
          }
        }}
        onBlur={(e) => void finish(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") void finish(e.currentTarget.value);
          if (e.key === "Escape") void finish(null);
        }}
        className={cn("mx-auto h-8 w-full max-w-80 rounded-md border border-input bg-app px-2 text-center text-sm font-semibold", focusRing)}
      />
    );
  }
  return (
    <h1 className="text-sm font-semibold">
      <button
        type="button"
        onClick={() => setRenaming(true)}
        disabled={readOnly}
        aria-label={readOnly ? title : `${title}. Rename`}
        title={readOnly ? title : `${title} (click to rename)`}
        className={cn("mx-auto block max-w-full truncate rounded-md px-2 py-1 hover:bg-surface-hover disabled:hover:bg-transparent", focusRing)}
      >
        {title}
      </button>
    </h1>
  );
}

function FileMenu({ onRename }: { onRename: () => void }) {
  const store = useEditorStore();
  const readOnly = useEditor((s) => s.readOnly);
  const navigate = useNavigate();
  const renameNext = useRef(false);

  const makeCopy = async () => {
    const s = store.getState();
    const id = crypto.randomUUID();
    try {
      // the copy starts from what's on screen now, saved or not
      await api.createDesign({ id, title: `${s.design.title} (copy)`.slice(0, TITLE_MAX), width_px: s.design.width_px, height_px: s.design.height_px, display_unit: s.design.display_unit });
      await api.saveContent(id, s.content, 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't make a copy. Try again.", { kind: "error" });
      return;
    }
    navigate(`/design/${id}/edit`);
    toast("Made a copy. You're editing the copy now.");
  };

  const moveToTrash = async () => {
    const s = store.getState();
    const { id, title } = s.design;
    try {
      await s.flush(); // the last edits are saved first, so Undo brings back everything
      await api.trashDesign(id);
    } catch {
      toast("Couldn't move it to Trash. Try again.", { kind: "error" });
      return;
    }
    navigate("/");
    toast(`Moved "${title}" to Trash`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await api.restoreDesign(id);
          navigate(`/design/${id}/edit`);
        },
      },
    });
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm">
          File
        </Button>
      </Menu.Trigger>
      <Menu.Content
        onCloseAutoFocus={(e) => {
          // Rename: the title field gets the focus instead of the File button
          if (!renameNext.current) return;
          renameNext.current = false;
          e.preventDefault();
          onRename();
        }}
      >
        <Menu.Item disabled={readOnly} onSelect={() => (renameNext.current = true)}>
          Rename
        </Menu.Item>
        <Menu.Item onSelect={() => void makeCopy()}>Make a copy</Menu.Item>
        <Menu.Separator />
        <Menu.Item danger disabled={readOnly} onSelect={() => void moveToTrash()}>
          Move to Trash
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

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
  const [renaming, setRenaming] = useState(false);
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
      <FileMenu onRename={() => setRenaming(true)} />
      <div className="flex items-center gap-1">
        <IconButton label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => store.getState().undo()}>
          <Undo2 strokeWidth={1.75} aria-hidden />
        </IconButton>
        <IconButton label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => store.getState().redo()}>
          <Redo2 strokeWidth={1.75} aria-hidden />
        </IconButton>
      </div>
      <div className="min-w-0 flex-1 text-center">
        <Title renaming={renaming} setRenaming={setRenaming} />
      </div>
      <SaveStatus save={save} readOnly={readOnly} />
      <DownloadPanel exportRef={exportRef} />
    </header>
  );
}

/** Below the editor's minimum width (layout.editor-min-w): a short note instead. */
export function SmallScreenNote() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg">Open this on a larger screen</h1>
      <p className="max-w-80 text-sm text-muted">The editor needs a wider window, like a laptop or desktop screen.</p>
      <Link to="/" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
        Back to Home
      </Link>
    </main>
  );
}
