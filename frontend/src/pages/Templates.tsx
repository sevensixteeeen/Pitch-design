// S04 Templates: Pitch's own templates, searchable and filtered by kind. Picking one makes a new design
// from a copy of it (never linked back) and opens it in the editor.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { SearchX } from "lucide-react";
import { api } from "../data";
import { Button } from "../components/ui/Button";
import { EmptyState, Spinner, toast } from "../components/ui/feedback";
import { SearchInput } from "../components/ui/inputs";
import { cn, focusRing } from "../lib/cn";
import { CATEGORIES, categoryLabel, prepare, TEMPLATES, type Category, type Template } from "../templates";
import { TemplatePreview } from "../templates/TemplatePreview";

// fits inside the card's 4:3 picture area on the widest grid
const PREVIEW_BOX = { width: 168, height: 120 };

export function Templates() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [making, setMaking] = useState<string | null>(null);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return TEMPLATES.filter((t) => (!category || t.category === category) && (!words || `${t.title} ${categoryLabel(t.category)}`.toLowerCase().includes(words)));
  }, [q, category]);

  const use = async (t: Template) => {
    setMaking(t.id);
    const id = crypto.randomUUID();
    try {
      const content = await prepare(t);
      await api.createDesign({ id, title: t.title, width_px: t.width_px, height_px: t.height_px, display_unit: "px" });
      await api.saveContent(id, content, 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't make the design. Try again.", { kind: "error" });
      setMaking(null);
      return;
    }
    navigate(`/design/${id}/edit`);
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <h1 className="text-xl">Templates</h1>
          <p className="mt-1 text-sm text-muted">Start from one of these. You get your own copy to change however you like.</p>
        </div>
        <SearchInput value={q} onChange={setQ} label="Search templates" placeholder="Search templates" className="sm:w-72" />
      </div>

      <div role="group" aria-label="Kind of template" className="mt-6 flex flex-wrap gap-2">
        {[{ value: null, label: "All" }, ...CATEGORIES].map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={category === c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm transition-colors",
              category === c.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-hover",
              focusRing,
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section aria-label="Templates" className="mt-6">
        {shown.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No templates match"
            body="Try another word, or show all kinds."
            action={
              <Button
                onClick={() => {
                  setQ("");
                  setCategory(null);
                }}
              >
                Show all templates
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={making !== null}
                  aria-busy={making === t.id || undefined}
                  onClick={() => void use(t)}
                  className={cn("glass group block w-full rounded-lg border p-2 text-left transition-shadow hover:shadow-card disabled:opacity-70", focusRing)}
                >
                  <span className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-surface p-3">
                    <span className="shadow-card">
                      <TemplatePreview template={t} box={PREVIEW_BOX} />
                    </span>
                    {making === t.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-app/70">
                        <Spinner className="size-6" />
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block truncate px-1 text-sm font-semibold">{t.title}</span>
                  <span className="block px-1 text-xs text-muted">
                    {categoryLabel(t.category)} · {t.width_px} × {t.height_px}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
