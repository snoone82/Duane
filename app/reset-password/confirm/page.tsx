"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { Logo } from "@/components/ui/Logo";

/**
 * Reached from the emailed reset link. The browser Supabase client
 * exchanges the link's URL fragment into a real (recovery-scoped) session
 * automatically on load — by the time this component's checkSession runs,
 * getUser() either succeeds (link was valid) or doesn't (expired/already
 * used/opened directly without a link).
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
        setError("We couldn't update your password just now. Try the reset link again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    });
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col items-center justify-center px-6 py-16">
        <Logo className="mb-6" />
        <p className="text-ink-soft">One moment…</p>
      </main>
    );
  }

  if (linkInvalid) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center px-6 py-16">
        <Logo />
        <h1 className="mt-8 font-heading text-2xl text-ink">This link&apos;s no longer valid</h1>
        <p className="mt-2 text-base text-ink-soft">
          Reset links expire after a while, or may have already been used. Request a new one.
        </p>
        <Button onClick={() => router.push("/reset-password")} className="mt-6 w-full sm:w-auto">
          Request a new link
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-8 font-heading text-2xl text-ink">Set a new password</h1>

      {done ? (
        <Notice tone="success">Password updated — taking you to your dashboard.</Notice>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <TextField
            id="password"
            type="password"
            label="New password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" loading={isSubmitting} loadingText="Updating…" className="mt-2 w-full sm:w-auto">
            Set new password
          </Button>
        </form>
      )}
    </main>
  );
}
