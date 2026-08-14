"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/**
 * Reached from the emailed reset link. The browser Supabase client
 * exchanges the link's token into a recovery-scoped session automatically
 * on load — by the time checkSession runs, getUser() either succeeds (link
 * valid) or doesn't (expired / already used / page opened directly).
 */
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLinkInvalid(!user);
      setReady(true);
    });
  }, []);

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
        setError("Couldn't update your password just now. Try the reset link again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="mb-4 h-10 w-auto" />

        {!ready ? (
          <p className="text-sm text-ink-soft">One moment…</p>
        ) : linkInvalid ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-ink">This link&rsquo;s no longer valid</h1>
            <p className="mb-5 text-sm text-ink-soft">
              Reset links expire after a while, or may have already been used. Request a new one.
            </p>
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
