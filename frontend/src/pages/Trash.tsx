// S07 Trash: designs moved to Trash, with Restore and Delete forever. Thirty days after a design
// was moved here the server deletes it for good (backend/app/purge.py).
import { useCallback, useEffect, useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { api, type DesignSummary } from "../data";
import { CardGrid, DesignCard, DesignCardSkeleton, type CardAction } from "../components/DesignCard";
import { ConfirmDialog, useDialogState } from "../components/dialogs";
import { Button } from "../components/ui/Button";
import { EmptyState, toast } from "../components/ui/feedback";

export function Trash() {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const deleting = useDialogState<DesignSummary>();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const list = await api.listDesigns({ in_trash: true });
      // most recently moved here first
      setDesigns(list.sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")));
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (d: DesignSummary) => {
    try {
      await api.restoreDesign(d.id);
    } catch {
      toast("Couldn't restore it. Try again.", { kind: "error" });
      return;
    }
    toast(`Restored "${d.title}". It's back in Projects.`);
    void load();
  };

  const actions = (d: DesignSummary): CardAction[] => [
    { label: "Restore", onSelect: () => void restore(d) },
    { label: "Delete forever", onSelect: () => deleting.open(d), danger: true },
  ];

  return (
    <>
      <h1 className="text-xl">Trash</h1>
      <p className="mt-1 text-sm text-muted">Designs here are deleted for good 30 days after you move them to Trash.</p>

      <section aria-label="Designs in Trash" aria-busy={designs === null} className="mt-6">
        {failed ? (
          <EmptyState
            icon={<RotateCw />}
            title="Couldn't load Trash"
            body="Check your connection and try again."
            action={<Button onClick={load}>Try again</Button>}
          />
        ) : designs === null ? (
          <CardGrid>
            {Array.from({ length: 4 }, (_, i) => (
              <DesignCardSkeleton key={i} />
            ))}
          </CardGrid>
        ) : designs.length === 0 ? (
          <EmptyState icon={<Trash2 />} title="Trash is empty" body="When you move a design to Trash, it waits here for 30 days in case you want it back." />
        ) : (
          <CardGrid>
            {designs.map((d) => (
              // Restore and Delete forever are the point of this screen: keep their button in view
              <DesignCard key={d.id} design={d} actions={actions(d)} menuAlwaysVisible />
            ))}
          </CardGrid>
        )}
      </section>

      {deleting.value && (
        <ConfirmDialog
          title={`Delete "${deleting.value.title}" forever?`}
          body="It can't be brought back afterwards."
          confirmLabel="Delete forever"
          onClose={deleting.close}
          onConfirm={async () => {
            const d = deleting.value!;
            await api.deleteDesign(d.id);
            await load();
            deleting.close();
            toast(`Deleted "${d.title}" forever`);
          }}
        />
      )}
    </>
  );
}
