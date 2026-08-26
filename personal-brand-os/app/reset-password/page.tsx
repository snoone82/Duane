"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/**
 * Uses the browser Supabase client directly rather than a Server Action —
 * resetPasswordForEmail's redirectTo naturally comes from
 * window.location.origin (no new env var), and the follow-up step
 * (/reset-password/confirm) has to run client-side anyway, since the
 * recovery session only exists after the browser client processes the
 * emailed link. Same pattern the sibling Aligned app shipped and verified.
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

      // Supabase responds identically whether or not the address has an
      // account (so email existence isn't leaked). A real error here means
      // rate limiting or network trouble — worth surfacing.
      if (error) {
        setError("Couldn't send that just now — try again in a moment.");
        return;
      }
      setSent(true);
    });
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(680px 400px at 50% 8%, rgba(33, 201, 224, 0.15), transparent 65%), radial-gradient(760px 480px at 88% 95%, rgba(139, 92, 246, 0.12), transparent 60%)",
        }}
      />
      <div
        className="relative w-full max-w-sm rounded-xl border bg-surface/80 p-6 backdrop-blur"
        style={{ borderColor: "rgba(33, 201, 224, 0.25)", boxShadow: "0 0 50px rgba(33, 201, 224, 0.1), 0 14px 34px rgba(0, 0, 0, 0.5)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="mb-5 h-12 w-auto" />
        <h1 className="mb-1 text-lg font-light text-ink">Reset your password</h1>

        {sent ? (
          <div className="mt-4">
            <Notice kind="success">
              If there&rsquo;s an account with that email, a reset link is on its way. Check your inbox.
            </Notice>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-soft">
              Enter the email on your account and we&rsquo;ll send a link to set a new password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Notice kind="danger">{error}</Notice>}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
