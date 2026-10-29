// S06 Folder: the designs in one folder, with rename and delete for the folder itself.
// The API answers an empty list both for an empty folder and for one that isn't yours, so
// "not found" is decided from your own folder list.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronRight, Folder as FolderIcon, Pencil, RotateCw, Trash2 } from "lucide-react";
import { api, type DesignSummary, type Folder } from "../data";
import { CardGrid, DesignCard, DesignCardSkeleton } from "../components/DesignCard";
import { useDesignActions } from "../components/designActions";
import { designCount, useFolderActions } from "../components/folders";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton } from "../components/ui/feedback";
import { cn, focusRing } from "../lib/cn";
import { NotFound } from "./stubs";

export function FolderPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [folder, setFolder] = useState<Folder | null | undefined>(undefined); // null: not one of yours
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [folders, list] = await Promise.all([api.listFolders(), api.listDesigns({ folder_id: folderId })]);
      setFolder(folders.find((f) => f.id === folderId) ?? null);
      setDesigns(list);
    } catch {
      setFailed(true);
    }
  }, [folderId]);
  useEffect(() => {
    setFolder(undefined);
    setDesigns(null);
    void load();
  }, [load]);

  const designActions = useDesignActions(load);
  const folderActions = useFolderActions(load, () => navigate("/projects", { replace: true }));

  if (folder === null) return <NotFound />;

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1 text-sm text-muted">
          <li>
            <Link to="/projects" className={cn("rounded-sm hover:text-fg hover:underline", focusRing)}>
              Projects
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-4" />
          </li>
          <li aria-current="page" className="min-w-0 truncate text-fg" title={folder?.name}>
            {folder?.name ?? "…"}
          </li>
        </ol>
      </nav>

      {failed ? (
        <EmptyState
          icon={<RotateCw />}
          title="Couldn't load this folder"
          body="Check your connection and try again."
          action={<Button onClick={load}>Try again</Button>}
        />
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              {folder ? (
                <>
                  <h1 className="text-xl break-words">{folder.name}</h1>
                  <p className="text-sm text-muted">{designCount(designs?.length ?? folder.design_count)}</p>
                </>
              ) : (
                <div aria-busy="true">
                  <span className="sr-only">Loading the folder</span>
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="mt-1 h-4 w-20" />
                </div>
              )}
            </div>
            {folder && (
              <div className="flex gap-2">
                <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => folderActions.rename(folder)}>
                  Rename
                </Button>
                <Button icon={<Trash2 className="size-4" aria-hidden />} onClick={() => folderActions.remove(folder)}>
                  Delete folder
                </Button>
              </div>
            )}
          </div>

          <section aria-label="Designs in this folder" aria-busy={designs === null} className="mt-6">
            {designs === null ? (
              <CardGrid>
                {Array.from({ length: 4 }, (_, i) => (
                  <DesignCardSkeleton key={i} />
                ))}
              </CardGrid>
            ) : designs.length === 0 ? (
              <EmptyState
                icon={<FolderIcon />}
                title="This folder is empty"
                body={`To put a design here, open its "…" menu in Projects and choose "Move to folder…".`}
              />
            ) : (
              <CardGrid>
                {designs.map((d) => (
                  <DesignCard key={d.id} design={d} actions={designActions.actions(d)} />
                ))}
              </CardGrid>
            )}
          </section>
        </>
      )}
      {designActions.dialog}
      {folderActions.dialog}
    </>
  );
}
