"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Logo } from "@/components/ui/Logo";

/**
 * Root-level error boundary for everything under the root layout. Next.js
 * renders this in place of a route segment when it (or anything it renders)
 * throws — it can't catch errors thrown by the root layout itself, that's
 * what app/global-error.tsx is for.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the real cause for whoever's debugging — the visitor only ever
    // sees the calm message below.
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center gap-6 px-6 py-16">
      <Logo />
      <h1 className="font-heading text-2xl text-ink">Something didn&rsquo;t load right</h1>
      <Notice tone="error">
        That&rsquo;s on us, not you — anything you&rsquo;d already saved is safe. Try again,
        or head back to the start.
      </Notice>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => reset()} className="w-full sm:w-auto">
          Try again
        </Button>
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Go to the start
          </Button>
        </Link>
      </div>
    </main>
  );
}
