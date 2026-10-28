import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { api, usingFakeData } from "../data";
import { useAuth } from "../auth";
import { Button } from "../components/ui/Button";
import { PasswordField, TextField } from "../components/ui/inputs";

type Mode = "signup" | "login" | "forgot";

const headings: Record<Mode, string> = {
  signup: "Make your first design",
  login: "Welcome back",
  forgot: "Reset your password",
};

/** The card every sign-in screen sits in. */
export function AuthCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface p-4">
      <main className="w-full max-w-100 rounded-lg bg-app p-6 shadow-pop">
        <p className="text-sm text-muted">Pitch</p>
        <h1 className="mt-1 text-xl">{heading}</h1>
        {children}
        {usingFakeData && <p className="mt-6 text-xs text-muted">Test build: accounts are stored only in this browser.</p>}
      </main>
    </div>
  );
}

const linkStyle = "font-semibold text-accent underline-offset-2 hover:underline";

/** S01: sign up / log in / ask for a password-reset link. */
export function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; mode?: Mode } | null;
  const from = state?.from ?? "/";
  const [mode, setMode] = useState<Mode>(state?.mode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setLinkSent(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api.requestPasswordReset(email);
        setLinkSent(true);
        return;
      }
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
    <AuthCard heading={headings[mode]}>
      {mode === "forgot" && (
        <p className="mt-2 text-sm text-muted">Enter the email you signed up with. We'll send a link to choose a new password.</p>
      )}
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {linkSent && (
          // the same words whether or not the account exists, so the form can't be used to find accounts
          <p role="status" className="rounded-md border border-input px-3 py-2 text-sm">
            {usingFakeData
              ? "Test build: no email is sent. Log in, then open /reset-password to try the new-password screen."
              : "If there's a Pitch account for that email, a link is on its way. It works once; check your spam folder too."}
          </p>
        )}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== "forgot" && (
          <div className="flex flex-col gap-1">
            <PasswordField
              label="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              hint={mode === "signup" ? "At least 8 characters." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "login" && (
              <button type="button" className={`self-end text-xs ${linkStyle}`} onClick={() => switchTo("forgot")}>
                Forgot password?
              </button>
            )}
          </div>
        )}
        <Button type="submit" variant="primary" loading={busy} disabled={!email || (mode !== "forgot" && !password)}>
          {mode === "signup" ? "Create account" : mode === "login" ? "Log in" : linkSent ? "Send again" : "Send link"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "signup" ? "Have an account?" : mode === "login" ? "New here?" : "Remembered it?"}{" "}
        <button type="button" className={linkStyle} onClick={() => switchTo(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </AuthCard>
  );
}
