import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getDefaultPathForUser } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthProvider";

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL || "/api";
  return baseUrl.replace(/\/$/, "");
}

async function requestPasswordReset(email: string) {
  const response = await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error("Could not request password reset.");
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname || null;

  useEffect(() => {
    setError(null);
  }, [email, password]);

  if (currentUser) {
    return <Navigate to={getDefaultPathForUser(currentUser)} replace />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const user = login(email, password);
      navigate(from || getDefaultPathForUser(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetMessage(null);
    setResetError(null);
    setIsSendingReset(true);

    try {
      await requestPasswordReset(resetEmail);
      setResetMessage(
        "If this email exists, a password reset email will be sent."
      );
      setResetEmail("");
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Could not request password reset."
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Dashboard login
            </h1>
            <p className="text-sm text-muted-foreground">
              Client-based access for this dashboard.
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="dashboard-login-email">
              Email address
            </label>
            <input
              id="dashboard-login-email"
              name="dashboard-login-email-empty"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="dashboard-login-password"
            >
              Password
            </label>
            <input
              id="dashboard-login-password"
              name="dashboard-login-password-empty"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Login
          </button>
        </form>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Forgot password?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter your email address to request a reset link.
          </p>

          <form className="mt-4 space-y-3" onSubmit={handlePasswordReset} autoComplete="off">
            <input
              type="email"
              name="dashboard-reset-email-empty"
              autoComplete="off"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              required
            />

            {resetMessage && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
                {resetMessage}
              </div>
            )}

            {resetError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {resetError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingReset}
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSendingReset ? "Sending..." : "Send reset email"}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
