// The "…" menu on a design card (Home S02, Projects S05): rename, move to Trash (with Undo).
import { useRef, useState, type FormEvent } from "react";
import { api, type DesignSummary } from "../data";
import type { CardAction } from "./DesignCard";
import { Button } from "./ui/Button";
import { toast } from "./ui/feedback";
import { TextField } from "./ui/inputs";
import { Dialog } from "./ui/overlays";

/** Menu actions for a card; `changed` reloads the list afterwards. */
export function useDesignActions(changed: () => void) {
  const [renaming, setRenaming] = useState<DesignSummary | null>(null);
  // the card's "…" button: keyboard focus goes back to it when the dialog closes
  const returnTo = useRef<HTMLElement | null>(null);
  const closeDialog = () => {
    setRenaming(null);
    setTimeout(() => returnTo.current?.isConnected && returnTo.current.focus(), 0);
  };

  const moveToTrash = async (d: DesignSummary) => {
    try {
      await api.trashDesign(d.id);
    } catch {
      toast("Couldn't move it to Trash. Try again.", { kind: "error" });
      return;
    }
    changed();
    toast(`Moved "${d.title}" to Trash`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await api.restoreDesign(d.id);
          changed();
        },
      },
    });
  };

  const actions = (d: DesignSummary): CardAction[] => [
    // opened once the menu has closed: a closing menu hands focus back to its own button,
    // which would otherwise take it away from the dialog's title field
    {
      label: "Rename",
      onSelect: () => {
        returnTo.current = document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]');
        setTimeout(() => setRenaming(d), 0);
      },
    },
    { label: "Move to Trash", onSelect: () => void moveToTrash(d), danger: true },
  ];

  const dialog = renaming && (
    <RenameDialog
      design={renaming}
      onClose={closeDialog}
      onRenamed={() => {
        closeDialog();
        changed();
      }}
    />
  );
  return { actions, dialog };
}

function RenameDialog({ design, onClose, onRenamed }: { design: DesignSummary; onClose: () => void; onRenamed: () => void }) {
  const [title, setTitle] = useState(design.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const clean = title.trim();
  const tooLong = clean.length > 255;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || tooLong) return;
    if (clean === design.title) return onClose();
    setBusy(true);
    setError(null);
    try {
      await api.updateDesign(design.id, { title: clean });
      toast("Renamed");
      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rename it. Try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Rename design" preventClose={busy} initialFocus={field}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField
          ref={field}
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => e.target.select()}
          error={tooLong ? "Use at most 255 characters." : !clean ? "Give it a name." : null}
          disabled={busy}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!clean || tooLong}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
