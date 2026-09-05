"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reconcilePlanRequirements } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";

/** Re-runs the same production-requirements pass importAiOutput triggers
 * automatically — for after hand-adding or editing Master Content / Platform
 * Outputs, so the auto-generated Requirements stay caught up. */
export function RecomputeRequirementsButton({ clientId, planId }: { clientId: string; planId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await reconcilePlanRequirements(clientId, planId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const { created, updated, removed } = result.data;
      setMessage(`${created} added, ${updated} updated, ${removed} cleared.`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={run} disabled={isPending}>
        {isPending ? "Recomputing…" : "Recompute requirements"}
      </Button>
      {message && <span className="text-xs text-ink-faint">{message}</span>}
    </div>
  );
}
