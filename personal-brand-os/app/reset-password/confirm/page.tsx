"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/**
 * Where the emailed reset link ends up.
 *
 * Previously this page decided the link was dead purely because nobody was
 * signed in by the time it loaded — which is also exactly what a VALID link
 * looks like when the browser client declines to exchange it (see
 * app/auth/confirm/route.ts). Duane's loop was the app mislabelling a good
 * link as expired and sending people back to request another one.
 *
 * Now /auth/confirm does the exchange server-side and passes a reason here
 * when it fails, so this page can say which of the genuinely different
 * problems happened. The one case still handled in the browser is an
 * implicit-flow link, whose tokens live in the URL fragment and never reach
 * the server — supabase-js picks those up on load.
 */

/** What went wrong, in words that tell someone what to actually do. */
function explain(reason: string | null): { title: string; body: string } {
  switch (reason) {
    case "otp_expired":
    case "expired_token":
      return {
        title: "This link has expired",
        body: "Reset links are only good for a short window. Request a new one and open it as soon as it arrives.",
      };
    case "code_exchange_failed":
    case "flow_state_not_found":
    case "flow_state_expired":
      return {
        title: "Open the link in the same browser",
        body: "This link was requested in a different browser from the one that opened it — a phone versus a laptop, or your email app's built-in browser. Copy the link into the browser you use for PBOS, or request a new one from that browser and click it there.",
      };
    case "access_denied":
      return {
        title: "This link has already been used",
        body: "Reset links work once. If you didn't use it yourself, something scanned the email first — request a new one and open it straight away.",
      };
    default:
      return {
        title: "This link didn't work",
        body: "Request a new one below. If it keeps happening, ask Duane to set you a temporary password instead.",
      };
  }
}

function ResetPasswordConfirm() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();

  const reason = params.get("reason");

  useEffect(() => {
    // /auth/confirm already tried and told us why it couldn't. Don't re-test.
    if (reason) {
      setFailure(reason);
      setReady(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setFailure(user ? null : "no_session");
      setReady(true);
    });
  }, [reason]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }

    startSubmitting(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || "Couldn't update your password just now.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    });
  }

  const problem = failure ? explain(failure) : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="mb-4 h-10 w-auto" />

        {!ready ? (
          <p className="text-sm text-ink-soft">One moment…</p>
        ) : problem ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-ink">{problem.title}</h1>
            <p className="mb-5 text-sm text-ink-soft">{problem.body}</p>
            <Button variant="primary" className="w-full" onClick={() => router.push("/reset-password")}>
              Request a new link
            </Button>
          </>
        ) : (
          <>
            <h1 className="mb-4 text-lg font-semibold text-ink">Set a new password</h1>
            {done ? (
              <Notice kind="success">Password updated — taking you to your dashboard.</Notice>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Notice kind="danger">{error}</Notice>}
                <div>
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>
                </div>
                <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Updating…" : "Set new password"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordConfirm />
    </Suspense>
  );
}
