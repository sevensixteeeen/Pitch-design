import { NavLink, Outlet } from "react-router";
import { FolderOpen, Home, LayoutTemplate, LogOut, Settings, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import { cn, focusRing } from "../lib/cn";
import { IconButton } from "../components/ui/Button";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/trash", label: "Trash", icon: Trash2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Sidebar + content for every screen outside the editor (S02, S04–S07, S23). */
export function AppLayout() {
  const { user, logOut } = useAuth();
  return (
    <div className="flex h-full flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-app focus:p-2">
        Skip to content
      </a>
      <aside className="flex shrink-0 items-center gap-1 border-b border-border bg-app px-2 py-2 md:w-(--tk-layout-sidebar-w) md:flex-col md:items-stretch md:border-r md:border-b-0 md:px-3 md:py-4">
        <p className="hidden px-3 pb-4 text-lg md:block">Canva clone</p>
        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  isActive ? "bg-accent-soft font-semibold text-accent" : "text-fg hover:bg-surface-hover",
                  focusRing,
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 md:border-t md:border-border md:px-1 md:pt-3">
          <p className="hidden min-w-0 flex-1 truncate text-xs text-muted md:block" title={user?.email}>
            {user?.email}
          </p>
          <IconButton label="Log out" onClick={logOut}>
            <LogOut aria-hidden />
          </IconButton>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-(--tk-layout-content-max) px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
