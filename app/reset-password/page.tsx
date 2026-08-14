"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { Logo } from "@/components/ui/Logo";

/**
 * Uses the browser Supabase client directly rather than a Server Action —
 * resetPasswordForEmail's redirectTo naturally comes from
 * window.location.origin here, with no new env var needed, and the
 * follow-up step (app/reset-password/confirm) has to run client-side
 * anyway, since the recovery session only exists after the browser client
 * processes the emailed link's URL fragment. Keeping both steps on the same
 * client avoids splitting one flow across two different Supabase client
 * instances for no real benefit.
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSubmitting(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      // Supabase itself won't reveal "no account with that email" here —
      // it responds the same way whether or not the address is registered,
      // to avoid leaking which emails have accounts. A real `error` at this
      // point means something actually went wrong (rate limit, network),
      // worth surfacing rather than silently claiming success.
      if (error) {
        console.error("resetPasswordForEmail failed —", error.message);
        setError("We couldn't send that just now — try again in a moment.");
        return;
      }

      setSent(true);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-8 font-heading text-2xl text-ink">Reset your password</h1>

      {sent ? (
        <Notice tone="success">
          If there&apos;s an account with that email, a reset link is on its way. Check your inbox.
        </Notice>
      ) : (
        <>
          <p className="mt-2 text-base text-ink-soft">
            Enter the email on your account and we&apos;ll send a link to set a new password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <TextField
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && <Notice tone="error">{error}</Notice>}

            <Button type="submit" loading={isSubmitting} loadingText="Sending…" className="mt-2 w-full sm:w-auto">
              Send reset link
            </Button>
          </form>
        </>
      )}

      <Link
        href="/login"
        className="mt-6 inline-flex min-h-[var(--tap-target-min)] w-fit items-center text-sm font-medium text-gold-strong underline"
      >
        Back to sign in
      </Link>
    </main>
  );
}
