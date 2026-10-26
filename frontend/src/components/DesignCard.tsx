import { Link } from "react-router";
import { MoreHorizontal } from "lucide-react";
import type { DesignSummary } from "../data";
import { cn, focusRing } from "../lib/cn";
import { IconButton } from "./ui/Button";
import { Menu } from "./ui/overlays";
import { Skeleton } from "./ui/feedback";

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export interface CardAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export function DesignCard({ design, actions = [] }: { design: DesignSummary; actions?: CardAction[] }) {
  const trashed = design.deleted_at !== null;
  const daysLeft = trashed ? Math.max(0, 30 - Math.floor((Date.now() - new Date(design.deleted_at!).getTime()) / 86_400_000)) : 0;
  const thumb = (
    <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-surface p-3">
      {design.thumbnail_url ? (
        <img src={design.thumbnail_url} alt="" className="max-h-full max-w-full object-contain shadow-card" />
      ) : (
        // no thumbnail yet: a box with the design's proportions
        <div
          aria-hidden
          className="max-h-full max-w-full bg-workspace"
          style={{ aspectRatio: `${design.width_px} / ${design.height_px}`, height: design.height_px >= design.width_px ? "100%" : "auto", width: design.width_px > design.height_px ? "100%" : "auto" }}
        />
      )}
    </div>
  );
  return (
    <div className="group relative rounded-lg border border-border bg-app p-2 transition-shadow hover:shadow-card">
      {trashed ? (
        thumb
      ) : (
        <Link to={`/design/${design.id}/edit`} className={cn("block rounded-md", focusRing)} aria-label={`Open ${design.title}`}>
          {thumb}
        </Link>
      )}
      <div className="mt-2 flex items-start gap-1 px-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={design.title}>
            {design.title}
          </p>
          <p className="text-xs text-muted">
            {trashed ? `Deletes in ${daysLeft} days` : `Edited ${timeAgo(design.updated_at)}`}
          </p>
        </div>
        {actions.length > 0 && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton label={`More actions for ${design.title}`} size="sm" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal aria-hidden />
              </IconButton>
            </Menu.Trigger>
            <Menu.Content align="end">
              {actions.map((a) => (
                <Menu.Item key={a.label} onSelect={a.onSelect} danger={a.danger}>
                  {a.label}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Root>
        )}
      </div>
    </div>
  );
}

export function DesignCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-2">
      <Skeleton className="aspect-4/3" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-1 h-3 w-1/2" />
    </div>
  );
}
