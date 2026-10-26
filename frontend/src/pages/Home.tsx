import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, RotateCw } from "lucide-react";
import { api, type DesignSummary } from "../data";
import { useAuth } from "../auth";
import { DesignCard, DesignCardSkeleton } from "../components/DesignCard";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/inputs";
import { EmptyState, toast } from "../components/ui/feedback";
import { CreateDesign } from "./CreateDesign";

/** S02: Home. Search, create, recent designs. */
export function Home() {
  const { user } = useAuth();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(async (query: string) => {
    setFailed(false);
    try {
      setDesigns(await api.listDesigns({ q: query || undefined }));
    } catch {
      setFailed(true);
    } finally {
      setSearching(false);
    }
  }, []);

  // debounce search 250 ms (components.md, SearchInput)
  useEffect(() => {
    setSearching(true);
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const moveToTrash = async (d: DesignSummary) => {
    await api.trashDesign(d.id);
    setDesigns((list) => list?.filter((x) => x.id !== d.id) ?? null);
    toast(`Moved "${d.title}" to Trash`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await api.restoreDesign(d.id);
          load(q);
        },
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <h1 className="text-xl">Hi{user?.display_name ? `, ${user.display_name}` : ""}! What will you make?</h1>
        <div className="flex flex-1 items-center gap-3 sm:justify-end">
          <SearchInput value={q} onChange={setQ} label="Search your designs" placeholder="Search your designs" loading={searching && !!q} className="flex-1 sm:max-w-80" />
          <CreateDesign />
        </div>
      </div>

      <section aria-labelledby="recent" aria-busy={designs === null} className="mt-8">
        <h2 id="recent" className="text-lg">
          {q ? "Results" : "Recent designs"}
        </h2>
        <p aria-live="polite" className="sr-only">
          {designs && q ? `${designs.length} results` : ""}
        </p>
        {failed ? (
          <EmptyState
            icon={<RotateCw />}
            title="Couldn't load your designs"
            body="Check your connection and try again."
            action={<Button onClick={() => load(q)}>Try again</Button>}
          />
        ) : designs === null ? (
          <Grid>
            {Array.from({ length: 4 }, (_, i) => (
              <DesignCardSkeleton key={i} />
            ))}
          </Grid>
        ) : designs.length === 0 ? (
          q ? (
            <EmptyState icon={<LayoutGrid />} title={`No designs match "${q}"`} action={<Button onClick={() => setQ("")}>Clear search</Button>} />
          ) : (
            <EmptyState icon={<LayoutGrid />} title="Nothing here yet" body="Pick a size and start your first design." action={<CreateDesign />} />
          )
        ) : (
          <Grid>
            {designs.map((d) => (
              <DesignCard key={d.id} design={d} actions={[{ label: "Move to Trash", onSelect: () => moveToTrash(d), danger: true }]} />
            ))}
          </Grid>
        )}
      </section>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
