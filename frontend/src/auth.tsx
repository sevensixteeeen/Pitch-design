import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { api, type User } from "./data";
import { Spinner } from "./components/ui/feedback";

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getUser().then(setUser).finally(() => setLoading(false));
  }, []);
  const logOut = useCallback(async () => {
    await api.logOut();
    setUser(null);
  }, []);
  return <AuthContext.Provider value={{ user, loading, setUser, logOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth needs <AuthProvider>");
  return ctx;
}

/** Sends signed-out visitors to /login and back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted" aria-busy="true">
        <Spinner className="size-6" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
