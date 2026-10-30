// S23 Settings: your account email and changing your password. (Deleting the account has a server
// route already, DELETE /api/me; its screen isn't built.)
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { api } from "../data";
import { Button } from "../components/ui/Button";
import { toast } from "../components/ui/feedback";
import { PasswordField } from "../components/ui/inputs";

export function Settings() {
  const { user } = useAuth();
  return (
    <>
      <h1 className="text-xl">Settings</h1>
      <div className="mt-6 flex max-w-140 flex-col gap-6">
        <section aria-labelledby="account" className="rounded-lg border border-border bg-app p-6">
          <h2 id="account" className="text-lg">
            Account
          </h2>
          <p className="mt-3 text-xs text-muted">Email</p>
          <p className="text-sm break-all">{user?.email}</p>
        </section>
        <ChangePassword />
      </div>
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setDone(true);
      toast("Password changed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="password" className="rounded-lg border border-border bg-app p-6">
      <h2 id="password" className="text-lg">
        Change password
      </h2>
      <p className="mt-1 text-sm text-muted">Type your current password first, so nobody else at this computer can change it.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            Your password is changed. Use the new one next time you log in.
          </p>
        )}
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={busy}
        />
        <div>
          <Button type="submit" variant="primary" loading={busy} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}
