// S05 Projects: your folders, then every design (sorted), each with its "…" actions.
// The Uploads tab, multi-select and the list view aren't built (not in the feature list).
import { useCallback, useEffect, useState } from "react";
import { FolderPlus, LayoutGrid, RotateCw } from "lucide-react";
import { api, type DesignSummary, type Folder } from "../data";
import { CardGrid, DesignCard, DesignCardSkeleton } from "../components/DesignCard";
import { useDesignActions } from "../components/designActions";
import { FolderCard, FolderCardSkeleton, useFolderActions } from "../components/folders";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/feedback";
import { SelectField } from "../components/ui/inputs";
import { CreateDesign } from "./CreateDesign";

type Sort = "updated" | "title";
const SORTS: { value: Sort; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "title", label: "Title A–Z" },
];

// the chosen sort is remembered in this browser; storage can be blocked (private windows), so
// reading or writing it never breaks the page
const SORT_KEY = "pitch.projects.sort";
function savedSort(): Sort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return SORTS.some((o) => o.value === v) ? (v as Sort) : "updated";
  } catch {
    return "updated";
  }
}

export function Projects() {
  const [sort, setSortState] = useState<Sort>(savedSort);
  const setSort = (next: Sort) => {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // not remembered, but still sorted
    }
  };
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [d, f] = await Promise.all([api.listDesigns({ sort }), api.listFolders()]);
      setDesigns(d);
      setFolders(f);
    } catch {
      setFailed(true);
    }
  }, [sort]);
  useEffect(() => {
    void load();
  }, [load]);

  const designActions = useDesignActions(load);
  const folderActions = useFolderActions(load);

  if (failed) {
    return (
      <>
        <h1 className="text-xl">Projects</h1>
        <EmptyState
          icon={<RotateCw />}
          title="Couldn't load your designs"
          body="Check your connection and try again."
          action={<Button onClick={load}>Try again</Button>}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <h1 className="text-xl">Projects</h1>
        <div className="flex flex-1 flex-wrap items-end gap-3 sm:justify-end">
          <div className="w-44">
            <SelectField label="Sort by" value={sort} options={SORTS} onChange={setSort} size="sm" />
          </div>
          <Button icon={<FolderPlus className="size-4" aria-hidden />} onClick={folderActions.newFolder}>
            New folder
          </Button>
          <CreateDesign />
        </div>
      </div>

      <section aria-labelledby="folders" aria-busy={folders === null} className="mt-8">
        <h2 id="folders" className="text-lg">
          Folders{folders && folders.length > 0 ? ` (${folders.length})` : ""}
        </h2>
        {folders === null ? (
          <CardGrid wide>
            {Array.from({ length: 3 }, (_, i) => (
              <FolderCardSkeleton key={i} />
            ))}
          </CardGrid>
        ) : folders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No folders yet. Make one with "New folder", then use "Move to folder…" on a design.</p>
        ) : (
          <CardGrid wide>
            {folders.map((f) => (
              <FolderCard key={f.id} folder={f} actions={folderActions.actions(f)} />
            ))}
          </CardGrid>
        )}
      </section>

      <section aria-labelledby="all-designs" aria-busy={designs === null} className="mt-8">
        <h2 id="all-designs" className="text-lg">
          All designs{designs && designs.length > 0 ? ` (${designs.length})` : ""}
        </h2>
        {designs === null ? (
          <CardGrid>
            {Array.from({ length: 8 }, (_, i) => (
              <DesignCardSkeleton key={i} />
            ))}
          </CardGrid>
        ) : designs.length === 0 ? (
          <EmptyState icon={<LayoutGrid />} title="No designs yet" body="Everything you make shows up here." action={<CreateDesign />} />
        ) : (
          <CardGrid>
            {designs.map((d) => (
              <DesignCard key={d.id} design={d} actions={designActions.actions(d)} />
            ))}
          </CardGrid>
        )}
      </section>
      {designActions.dialog}
      {folderActions.dialog}
    </>
  );
}
