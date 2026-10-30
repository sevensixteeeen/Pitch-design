import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { LayoutGrid, RotateCw, Sparkles } from "lucide-react";
import { api, type DesignSummary } from "../data";
import { useAuth } from "../auth";
import { cn, focusRing } from "../lib/cn";
import { DesignCard, DesignCardSkeleton } from "../components/DesignCard";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/inputs";
import { EmptyState } from "../components/ui/feedback";
import { useDesignActions } from "../components/designActions";
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

  const { actions, dialog } = useDesignActions(() => void load(q));

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-display">
            Hi{user?.display_name ? `, ${user.display_name}` : ""}! What will you <em>make</em>?
          </h1>
          <Link
            to="/templates"
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-pill border border-spark/45 bg-spark/10 px-3 py-1 text-xs font-semibold text-spark hover:bg-spark/20",
              focusRing,
            )}
          >
            <Sparkles className="size-3.5" aria-hidden /> Start from a template
          </Link>
        </div>
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
