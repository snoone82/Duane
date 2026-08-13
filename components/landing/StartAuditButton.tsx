"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startOrResumeAudit } from "@/app/actions/audit";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function StartAuditButton({ hasInProgress }: { hasInProgress: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    // Resuming skips the intro entirely — they've already read it, and
    // creating/finding the in-progress audit here (rather than on the intro
    // screen) sends them straight back to their current question.
    if (hasInProgress) {
      setError(null);
      startTransition(async () => {
        const result = await startOrResumeAudit();
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push("/audit");
      });
      return;
    }

    // Fresh start — no audit is created yet. That happens on the intro
    // screen's "Begin" click, so someone who reads the intro and leaves
    // doesn't end up with a stray in-progress row.
    router.push("/audit/intro");
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={handleClick}
        loading={isPending}
        loadingText="One moment…"
        className="w-full sm:w-auto"
      >
        {hasInProgress ? "Continue the Audit" : "Start the Audit"}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
