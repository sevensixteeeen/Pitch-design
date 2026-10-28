import type { ReactNode, RefObject } from "react";
import { Dialog as RDialog, DropdownMenu, Popover as RPopover } from "radix-ui";
import { X } from "lucide-react";
import { cn, focusRing } from "../../lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "sm",
  children,
  preventClose,
  initialFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "sm" | "md";
  children: ReactNode;
  /** true while submitting: Escape and outside clicks do nothing */
  preventClose?: boolean;
  /** what gets focus when the dialog opens (by default: its first button, the Close ✕) */
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={(o) => (preventClose && !o ? undefined : onOpenChange(o))}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RDialog.Content
          onOpenAutoFocus={(e) => {
            if (!initialFocus?.current) return;
            e.preventDefault();
            initialFocus.current.focus();
          }}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-app p-6 shadow-pop",
            size === "sm" ? "max-w-100" : "max-w-140",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-lg">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close aria-label="Close" disabled={preventClose} className={cn("rounded-md p-1 text-muted hover:bg-surface-hover hover:text-fg", focusRing)}>
              <X className="size-5" aria-hidden />
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

const menuContent = "z-50 min-w-48 rounded-lg border border-border bg-app p-1 shadow-pop";
const menuItem =
  "flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none select-none data-highlighted:bg-surface-hover data-disabled:opacity-50 [&_svg]:size-4";

export const Menu = {
  Root: DropdownMenu.Root,
  Trigger: DropdownMenu.Trigger,
  Content({
    children,
    align = "start",
    onCloseAutoFocus,
  }: {
    children: ReactNode;
    align?: "start" | "end" | "center";
    /** when the menu closes it gives focus back to its button; call preventDefault() to put it elsewhere */
    onCloseAutoFocus?: (e: Event) => void;
  }) {
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className={menuContent} onCloseAutoFocus={onCloseAutoFocus}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    );
  },
  Item({
    children,
    onSelect,
    shortcut,
    danger,
    disabled,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
  }) {
    return (
      <DropdownMenu.Item onSelect={onSelect} disabled={disabled} className={cn(menuItem, danger && "text-danger")}>
        {children}
        {shortcut && <span className="ml-auto pl-4 text-xs text-muted">{shortcut}</span>}
      </DropdownMenu.Item>
    );
  },
  Separator() {
    return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
  },
};

export const Popover = {
  Root: RPopover.Root,
  Trigger: RPopover.Trigger,
  Close: RPopover.Close,
  Content({ children, align = "start", className, label }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string; label: string }) {
    return (
      <RPopover.Portal>
        <RPopover.Content aria-label={label} align={align} sideOffset={6} className={cn("z-50 rounded-lg border border-border bg-app p-4 shadow-pop outline-none", className)}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    );
  },
};
