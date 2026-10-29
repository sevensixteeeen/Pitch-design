// Folders (S05 Projects, S06 Folder): the folder card, its "…" actions, and "Move to folder…" for a design.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Folder as FolderIcon, RotateCw } from "lucide-react";
import { api, type DesignSummary, type Folder } from "../data";
import { cn, focusRing } from "../lib/cn";
import { CardMenu, type CardAction } from "./DesignCard";
import { ConfirmDialog, NameDialog, useDialogState } from "./dialogs";
import { Button } from "./ui/Button";
import { Skeleton, toast } from "./ui/feedback";
import { SelectField, TextField } from "./ui/inputs";
import { Dialog } from "./ui/overlays";

export const FOLDER_NAME_MAX = 100; // same as the API

export function designCount(n: number) {
  return n === 1 ? "1 design" : `${n} designs`;
}

export function FolderCard({ folder, actions }: { folder: Folder; actions: CardAction[] }) {
  return (
    <div className="group relative flex items-center gap-3 rounded-lg border border-border bg-app p-3 transition-shadow hover:shadow-card">
      <FolderIcon className="size-8 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0 flex-1">
        {/* the link covers the whole card; the "…" button sits above it */}
        <Link
          to={`/folders/${folder.id}`}
          title={folder.name}
          className={cn("block truncate rounded-sm text-sm font-semibold after:absolute after:inset-0 after:rounded-lg", focusRing)}
        >
          {folder.name}
        </Link>
        <p className="text-xs text-muted">{designCount(folder.design_count)}</p>
      </div>
      <CardMenu label={`More actions for folder ${folder.name}`} actions={actions} />
    </div>
  );
}

export function FolderCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="size-8" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1 h-3 w-1/3" />
      </div>
    </div>
  );
}

type FolderDialog = { kind: "new" } | { kind: "rename"; folder: Folder } | { kind: "delete"; folder: Folder };

/**
 * New folder, rename and delete. `changed` reloads the screen afterwards; `onDeleted` runs instead
 * when a folder is deleted (the folder's own page goes back to Projects).
 */
export function useFolderActions(changed: () => void | Promise<void>, onDeleted?: () => void | Promise<void>) {
  const state = useDialogState<FolderDialog>();
  const d = state.value;

  const rename = (folder: Folder) => state.open({ kind: "rename", folder });
  const remove = (folder: Folder) => state.open({ kind: "delete", folder });
  const actions = (folder: Folder): CardAction[] => [
    { label: "Rename", onSelect: () => rename(folder) },
    { label: "Delete folder", onSelect: () => remove(folder), danger: true },
  ];

  const dialog =
    d?.kind === "new" ? (
      <NameDialog
        title="New folder"
        label="Folder name"
        max={FOLDER_NAME_MAX}
        saveLabel="Create folder"
        onClose={state.close}
        onSave={async (name) => {
          await api.createFolder(name);
          await changed(); // the list shows it before the dialog closes
          state.close();
          toast(`Made the folder "${name}"`);
        }}
      />
    ) : d?.kind === "rename" ? (
      <NameDialog
        title="Rename folder"
        label="Folder name"
        initial={d.folder.name}
        max={FOLDER_NAME_MAX}
        saveLabel="Save"
        onClose={state.close}
        onSave={async (name) => {
          await api.renameFolder(d.folder.id, name);
          await changed(); // the screen shows the new name before the dialog closes
          state.close();
          toast("Renamed");
        }}
      />
    ) : d?.kind === "delete" ? (
      <ConfirmDialog
        title={`Delete the folder "${d.folder.name}"?`}
        body={
          d.folder.design_count === 0
            ? "It's empty, so nothing else changes."
            : d.folder.design_count === 1
              ? "The design in it won't be deleted: it stays in Projects, outside any folder."
              : `The ${d.folder.design_count} designs in it won't be deleted: they stay in Projects, outside any folder.`
        }
        confirmLabel="Delete folder"
        onClose={state.close}
        onConfirm={async () => {
          await api.deleteFolder(d.folder.id);
          await (onDeleted ?? changed)();
          state.close();
          toast(`Deleted the folder "${d.folder.name}"`);
        }}
      />
    ) : null;

  return { actions, dialog, rename, remove, newFolder: () => state.open({ kind: "new" }) };
}

const NO_FOLDER = "none";
const NEW_FOLDER = "new";

/** Pick a folder (or none, or a new one) for one design. */
export function MoveToFolderDialog({ design, onClose, onMoved }: { design: DesignSummary; onClose: () => void; onMoved: () => void | Promise<void> }) {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const current = design.folder_id ?? NO_FOLDER;
  const [choice, setChoice] = useState<string>(current);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = useRef<HTMLButtonElement>(null);

  const load = async () => {
    setFailed(false);
    try {
      setFolders(await api.listFolders());
    } catch {
      setFailed(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (folders) select.current?.focus(); // the dialog opened before the list arrived
  }, [folders]);

  const name = newName.trim();
  const nameProblem = choice !== NEW_FOLDER ? null : name.length > FOLDER_NAME_MAX ? `Use at most ${FOLDER_NAME_MAX} characters.` : null;
  const ready = folders !== null && choice !== current && (choice !== NEW_FOLDER || (name.length > 0 && !nameProblem));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !folders) return;
    setBusy(true);
    setError(null);
    try {
      let target: Folder | null = folders.find((f) => f.id === choice) ?? null;
      if (choice === NEW_FOLDER) target = await api.createFolder(name);
      await api.updateDesign(design.id, { folder_id: target?.id ?? null });
      await onMoved();
      toast(target ? `Moved "${design.title}" to ${target.name}` : `"${design.title}" is no longer in a folder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move it. Try again.");
      setBusy(false);
    }
  };

  const options = [
    { value: NO_FOLDER, label: "No folder (only in Projects)" },
    ...(folders ?? []).map((f) => ({ value: f.id, label: f.name })),
    { value: NEW_FOLDER, label: "New folder…" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Move to folder" description={`Where should "${design.title}" go?`} preventClose={busy}>
      {failed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn't load your folders.
          </p>
          <Button icon={<RotateCw className="size-4" aria-hidden />} onClick={load}>
            Try again
          </Button>
        </div>
      ) : folders === null ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading your folders</span>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <SelectField label="Folder" value={choice} options={options} onChange={setChoice} triggerRef={select} />
          {choice === NEW_FOLDER && (
            <TextField label="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} error={nameProblem} disabled={busy} autoFocus />
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!ready}>
              Move
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
