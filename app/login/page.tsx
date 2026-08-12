"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSubmitting(async () => {
      const result = await signIn({ email, password });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-8 font-heading text-2xl text-ink">Sign in</h1>
      <p className="mt-2 text-base text-ink-soft">
        Already have an account? Sign in to see your results.
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
        <TextField
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && <Notice tone="error">{error}</Notice>}

        <Button
          type="submit"
          loading={isSubmitting}
          loadingText="Signing in…"
          className="mt-2 w-full sm:w-auto"
        >
          Sign in
        </Button>
      </form>
    </main>
  );
}
