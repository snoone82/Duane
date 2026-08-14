"use client";

import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mb-5 text-sm text-ink-soft">This page hit an unexpected error. Nothing else was affected.</p>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
