// Two small dialogs used across the app: type a name (rename a design, new folder, rename a
// folder) and "are you sure?" (delete a folder, delete forever).
import { useRef, useState, type FormEvent } from "react";
import { Button } from "./ui/Button";
import { TextField } from "./ui/inputs";
import { Dialog } from "./ui/overlays";

/**
 * Which dialog is open (and for what). Opening waits for a "…" menu to finish closing (a closing
 * menu hands focus back to its button, which would take it from the dialog's first field); closing
 * gives focus back to that "…" button, or to whatever opened the dialog.
 */
export function useDialogState<T>() {
  const [value, setValue] = useState<T | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const open = (v: T) => {
    returnTo.current =
      document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]') ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setTimeout(() => setValue(v), 0);
  };
  const close = () => {
    setValue(null);
    setTimeout(() => returnTo.current?.isConnected && returnTo.current.focus(), 0);
  };
  return { value, open, close };
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/** A dialog with one name field. `onSave` may throw; its message is shown and the dialog stays open. */
export function NameDialog({
  title,
  label,
  initial = "",
  max,
  saveLabel,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  max: number;
  saveLabel: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const clean = name.trim();
  const tooLong = clean.length > max;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || tooLong) return;
    if (initial && clean === initial) return onClose();
    setBusy(true);
    setError(null);
    try {
      await onSave(clean);
    } catch (err) {
      setError(errorText(err, "That didn't work. Try again."));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} preventClose={busy} initialFocus={field}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <TextField
          ref={field}
          label={label}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          // no "empty" message before anything is typed in a new name
          error={tooLong ? `Use at most ${max} characters.` : !clean && (initial || name) ? "Give it a name." : null}
          disabled={busy}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!clean || tooLong}>
            {saveLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Are you sure?" for something that can't be undone. Focus starts on Cancel, the safe choice. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(errorText(err, "That didn't work. Try again."));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description={body} preventClose={busy} initialFocus={cancel}>
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button ref={cancel} onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" loading={busy} onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
