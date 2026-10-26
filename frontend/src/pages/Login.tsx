import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { api, usingFakeData } from "../data";
import { useAuth } from "../auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/inputs";

/** S01: sign up / log in. */
export function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = mode === "signup" ? await api.signUp(email, password) : await api.logIn(email, password);
      setUser(u);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-surface p-4">
      <main className="w-full max-w-100 rounded-lg bg-app p-6 shadow-pop">
        <p className="text-sm text-muted">Canva clone</p>
        <h1 className="mt-1 text-xl">{mode === "signup" ? "Make your first design" : "Welcome back"}</h1>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" loading={busy} disabled={!email || !password}>
            {mode === "signup" ? "Create account" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signup" ? "Have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="font-semibold text-accent underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Log in" : "Create an account"}
          </button>
        </p>
        {usingFakeData && <p className="mt-6 text-xs text-muted">Test build: accounts are stored only in this browser.</p>}
      </main>
    </div>
  );
}
