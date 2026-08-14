"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeAudit } from "@/app/actions/audit";
import { createAccount } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { Logo } from "@/components/ui/Logo";
import { ScoreRing } from "@/components/ui/ScoreRing";

export function CompleteAuditClient({
  auditId,
  initialTotalScore,
}: {
  auditId: string;
  initialTotalScore: number | null;
}) {
  const router = useRouter();
  const [totalScore, setTotalScore] = useState<number | null>(initialTotalScore);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(initialTotalScore !== null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    if (totalScore !== null) return;
    let cancelled = false;

    (async () => {
      const result = await completeAudit(auditId);
      if (cancelled) return;
      if (!result.ok) {
        setCompleteError(result.message);
        return;
      }
      setTotalScore(result.data.totalScore);
      requestAnimationFrame(() => setRevealed(true));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setIsExistingAccount(false);

    if (password.length < 8) {
      setSignupError("Password needs to be at least 8 characters.");
      return;
    }

    startSubmitting(async () => {
      const result = await createAccount({ email, password, fullName });
      if (!result.ok) {
        setSignupError(result.message);
        setIsExistingAccount(Boolean(result.isExistingAccount));
        return;
      }
      router.push("/dashboard");
    });
  }

  if (completeError) {
    return <SessionNotice message={completeError} />;
  }

  if (totalScore === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col items-center justify-center px-6 py-16">
        <Logo className="mb-6" />
        <p className="text-ink-soft">Working out your score…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-16">
      <Logo />

      <div
        className={`mt-10 text-center transition-all duration-[var(--duration-slow)] ease-[var(--ease-standard)] ${
          revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <p className="label-caps text-sm text-gold">Your Alignment Score</p>
        <div className="mt-4 flex justify-center">
          <ScoreRing value={totalScore} max={100} size={200} />
        </div>
        <p className="mt-4 text-ink-faint">out of 100</p>
      </div>

      <div className="mt-12 border-t border-border pt-10">
        <h2 className="font-heading text-xl text-ink">
          You&apos;ve just done the hard part.
        </h2>
        <p className="mt-2 text-base text-ink-soft">
          Create your account to keep these results — and so Duane can start
          looking at what you shared.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextField
            id="fullName"
            label="Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
          <TextField
            id="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            id="password"
            type="password"
            label="Password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-soft">
            {/* Sized to the app's own 44px tap-target minimum, not the
                usual small checkbox — a smaller visual box would still
                pass a mouse click but fail the same tap-target rule every
                other interactive element in this app is held to. */}
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="h-[var(--tap-target-min)] w-[var(--tap-target-min)] shrink-0 rounded border-border-strong accent-[var(--color-gold)]"
            />
            I understand Duane personally reviews my responses, and I agree to Aligned
            storing them to build my results.
          </label>

          {signupError && (
            <Notice tone="error">
              {signupError}
              {isExistingAccount && (
                <>
                  {" "}
                  <Link href="/login" className="font-medium underline">
                    Sign in
                  </Link>
                </>
              )}
            </Notice>
          )}

          <Button
            type="submit"
            disabled={!consent}
            loading={isSubmitting}
            loadingText="Creating your account…"
            className="mt-2 w-full sm:w-auto"
          >
            Create my account
          </Button>
        </form>
      </div>
    </main>
  );
}
