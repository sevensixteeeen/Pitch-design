// The "…" menu on a design card (Home S02, Projects S05, Folder S06): rename, make a copy,
// move to a folder, move to Trash (with Undo).
import { api, type DesignSummary } from "../data";
import type { CardAction } from "./DesignCard";
import { NameDialog, useDialogState } from "./dialogs";
import { MoveToFolderDialog } from "./folders";
import { toast } from "./ui/feedback";

const TITLE_MAX = 255; // same as the API

type DesignDialog = { kind: "rename" | "move"; design: DesignSummary };

/** Menu actions for a card; `changed` reloads the list afterwards. */
export function useDesignActions(changed: () => void | Promise<void>) {
  const state = useDialogState<DesignDialog>();
  const d = state.value;

  const moveToTrash = async (design: DesignSummary) => {
    try {
      await api.trashDesign(design.id);
    } catch {
      toast("Couldn't move it to Trash. Try again.", { kind: "error" });
      return;
    }
    changed();
    toast(`Moved "${design.title}" to Trash`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await api.restoreDesign(design.id);
          changed();
        },
      },
    });
  };

  // same as File > Make a copy in the editor, but the copy stays here (in the same folder)
  const makeCopy = async (design: DesignSummary) => {
    const id = crypto.randomUUID();
    try {
      const { design: full } = await api.getDesign(design.id);
      await api.createDesign({ id, title: `${full.title} (copy)`.slice(0, TITLE_MAX), width_px: full.width_px, height_px: full.height_px, display_unit: full.display_unit });
      await api.saveContent(id, full.content, 1);
      if (full.folder_id) await api.updateDesign(id, { folder_id: full.folder_id });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't make a copy. Try again.", { kind: "error" });
      return;
    }
    await changed();
    toast(`Made a copy of "${design.title}"`);
  };

  const actions = (design: DesignSummary): CardAction[] => [
    { label: "Rename", onSelect: () => state.open({ kind: "rename", design }) },
    { label: "Make a copy", onSelect: () => void makeCopy(design) },
    { label: "Move to folder…", onSelect: () => state.open({ kind: "move", design }) },
    { label: "Move to Trash", onSelect: () => void moveToTrash(design), danger: true },
  ];

  const dialog =
    d?.kind === "rename" ? (
      <NameDialog
        title="Rename design"
        label="Title"
        initial={d.design.title}
        max={TITLE_MAX}
        saveLabel="Save"
        onClose={state.close}
        onSave={async (title) => {
          await api.updateDesign(d.design.id, { title });
          await changed(); // the card shows the new title before the dialog closes
          state.close();
          toast("Renamed");
        }}
      />
    ) : d?.kind === "move" ? (
      <MoveToFolderDialog
        design={d.design}
        onClose={state.close}
        onMoved={async () => {
          await changed(); // the list is up to date before the dialog closes
          state.close();
        }}
      />
    ) : null;

  return { actions, dialog };
}
