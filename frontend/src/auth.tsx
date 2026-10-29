import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { CloudOff } from "lucide-react";
import { api, type User } from "./data";
import { Button } from "./components/ui/Button";
import { EmptyState, Spinner } from "./components/ui/feedback";

interface AuthState {
  user: User | null;
  loading: boolean;
  /**
   * Pitch's server didn't answer while checking who's logged in (BUG-010). Not the same as logged
   * out: the login may be fine, so screens say the server can't be reached and offer `retry`.
   */
  unreachable: boolean;
  retry: () => void;
  setUser: (u: User | null) => void;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const check = useCallback(() => {
    setLoading(true);
    setUnreachable(false);
    api
      .getUser()
      .then(setUser)
      .catch(() => setUnreachable(true)) // a signed-out user comes back as null, not as an error
      .finally(() => setLoading(false));
  }, []);
  useEffect(check, [check]);
  const logOut = useCallback(async () => {
    await api.logOut();
    setUser(null);
  }, []);
  return <AuthContext.Provider value={{ user, loading, unreachable, retry: check, setUser, logOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth needs <AuthProvider>");
  return ctx;
}

/** Shown instead of a screen when Pitch's server can't be reached. */
export function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <EmptyState
        icon={<CloudOff />}
        title="Can't reach Pitch's server"
        body="Check your internet connection. If Pitch runs on this computer, check that the API server is running (HOW-TO-RUN.md, step 4), then try again."
        action={<Button onClick={onRetry}>Try again</Button>}
      />
    </main>
  );
}

/** Sends signed-out visitors to /login and back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, unreachable, retry } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted" aria-busy="true">
        <Spinner className="size-6" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  // not "log in again": the login itself may be fine (BUG-010)
  if (unreachable) return <ServerUnreachable onRetry={retry} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
