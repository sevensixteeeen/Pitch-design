// S05 Projects: every design, sorted, with rename and move to Trash.
// Folders, Uploads tab, multi-select and the list view come with milestone 3 (S06, S07).
import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, RotateCw } from "lucide-react";
import { api, type DesignSummary } from "../data";
import { DesignCard, DesignCardSkeleton } from "../components/DesignCard";
import { useDesignActions } from "../components/designActions";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/feedback";
import { SelectField } from "../components/ui/inputs";
import { CreateDesign } from "./CreateDesign";

type Sort = "updated" | "title";
const SORTS: { value: Sort; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "title", label: "Title A–Z" },
];

export function Projects() {
  const [sort, setSort] = useState<Sort>("updated");
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setDesigns(await api.listDesigns({ sort }));
    } catch {
      setFailed(true);
    }
  }, [sort]);
  useEffect(() => {
    void load();
  }, [load]);

  const { actions, dialog } = useDesignActions(load);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <h1 className="text-xl">Projects</h1>
        <div className="flex flex-1 items-end gap-3 sm:justify-end">
          <div className="w-44">
            <SelectField label="Sort by" value={sort} options={SORTS} onChange={setSort} size="sm" />
          </div>
          <CreateDesign />
        </div>
      </div>

      <section aria-labelledby="all-designs" aria-busy={designs === null} className="mt-8">
        <h2 id="all-designs" className="text-lg">
          All designs{designs && designs.length > 0 ? ` (${designs.length})` : ""}
        </h2>
        {failed ? (
          <EmptyState
            icon={<RotateCw />}
            title="Couldn't load your designs"
            body="Check your connection and try again."
            action={<Button onClick={load}>Try again</Button>}
          />
        ) : designs === null ? (
          <Grid>
            {Array.from({ length: 8 }, (_, i) => (
              <DesignCardSkeleton key={i} />
            ))}
          </Grid>
        ) : designs.length === 0 ? (
          <EmptyState icon={<LayoutGrid />} title="No designs yet" body="Everything you make shows up here." action={<CreateDesign />} />
        ) : (
          <Grid>
            {designs.map((d) => (
              <DesignCard key={d.id} design={d} actions={actions(d)} />
            ))}
          </Grid>
        )}
      </section>
      {dialog}
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
