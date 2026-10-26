import type { ReactNode } from "react";
import { Toast } from "radix-ui";
import { Loader2, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "../../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("size-4 animate-spin", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-hover", className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-90 flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="text-muted [&_svg]:size-8" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg">{title}</h2>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

// ---- toasts --------------------------------------------------------------

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}
interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}
let nextToast = 1;
const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: nextToast++ }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** Show a toast from anywhere: toast("Saved") or toast("Couldn't upload", { kind: "error" }). */
export function toast(message: string, opts: { kind?: ToastKind; action?: ToastItem["action"] } = {}) {
  useToasts.getState().push({ message, kind: opts.kind ?? "info", action: opts.action });
}

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <Toast.Provider swipeDirection="down" duration={5000}>
      {items.map((t) => (
        <ToastRow key={t.id} item={t} onClose={() => dismiss(t.id)} />
      ))}
      <Toast.Viewport className="fixed bottom-4 left-1/2 z-50 flex w-90 max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}

function ToastRow({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  return (
    <Toast.Root
      type={item.kind === "error" ? "foreground" : "background"}
      // errors stay until dismissed
      duration={item.kind === "error" ? Infinity : 5000}
      onOpenChange={(open) => !open && onClose()}
      className="flex items-center gap-3 rounded-md bg-inverse px-4 py-3 text-sm text-on-inverse shadow-pop"
    >
      <Toast.Description className="flex-1">{item.message}</Toast.Description>
      {item.action && (
        <Toast.Action altText={item.action.label} asChild>
          <button type="button" onClick={item.action.onClick} className="font-semibold underline underline-offset-2">
            {item.action.label}
          </button>
        </Toast.Action>
      )}
      <Toast.Close aria-label="Dismiss" className="opacity-70 hover:opacity-100">
        <X className="size-4" aria-hidden />
      </Toast.Close>
    </Toast.Root>
  );
}
