import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api } from "../data";
import { useAuth } from "../auth";
import { Button } from "../components/ui/Button";
import { Spinner, toast } from "../components/ui/feedback";
import { PasswordField } from "../components/ui/inputs";
import { AuthCard } from "./Login";

/**
 * S01, step 2 of "Forgot password?": the email link logs the user in and lands here. Without a login
 * (link expired, already used, or opened by hand) it offers a new link instead.
 */
export function ResetPassword() {
  const { user, loading, unreachable, retry } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the session from the link is set up while this loads; deciding earlier would flash "expired"
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted" aria-busy="true">
        <Spinner className="size-6" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  // the link may well have worked: only Pitch's server didn't answer, so don't call it expired (BUG-010)
  if (unreachable) {
    return (
      <AuthCard heading="Can't reach Pitch's server">
        <p className="mt-2 text-sm text-muted">
          Your link was fine, but Pitch's server didn't answer. Check your internet connection. If Pitch runs on this computer, check that the API
          server is running, then try again.
        </p>
        <Button variant="primary" className="mt-6 w-full" onClick={retry}>
          Try again
        </Button>
      </AuthCard>
    );
  }

  if (!user) {
    return (
      <AuthCard heading="This link doesn't work any more">
        <p className="mt-2 text-sm text-muted">Reset links work once and expire after an hour. Ask for a new one.</p>
        <Button variant="primary" className="mt-6 w-full" onClick={() => navigate("/login", { state: { mode: "forgot" } })}>
          Send a new link
        </Button>
      </AuthCard>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.setNewPassword(password);
      toast("Password changed");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthCard heading="Choose a new password">
      <p className="mt-2 text-sm text-muted">For {user.email}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          required
          autoFocus
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={busy} disabled={!password}>
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
