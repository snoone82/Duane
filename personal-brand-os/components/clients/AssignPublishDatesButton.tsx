"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlanPublishDates } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";

/** Re-runs the same deterministic date-assignment pass importAiOutput
 * triggers automatically — for after hand-adding Master Content or changing
 * a lead platform. PBOS distributes dates across the month from each lead
 * platform's cadence; the AI is never asked to pick one. */
export function AssignPublishDatesButton({ clientId, planId }: { clientId: string; planId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await assignPlanPublishDates(clientId, planId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const { assigned, skipped } = result.data;
      setMessage(`${assigned} assigned${skipped > 0 ? `, ${skipped} skipped (no lead platform set)` : ""}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={run} disabled={isPending}>
        {isPending ? "Assigning…" : "Assign publish dates"}
      </Button>
      {message && <span className="text-xs text-ink-faint">{message}</span>}
    </div>
  );
}
