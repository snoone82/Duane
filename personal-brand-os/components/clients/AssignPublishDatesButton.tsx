"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlanPublishDates } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";

/** Re-runs the same deterministic date-assignment pass importAiOutput
 * triggers automatically — for after hand-adding Platform Outputs, changing
 * which account one publishes to, or changing an account's posting days on
 * the Social tab. PBOS spreads each account's outputs across that account's
 * posting days, one per day, then spaces same-idea siblings on the same
 * platform apart; the AI is never asked to pick one. */
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
      const { assigned, skipped, offPreferredDays, doubledUp } = result.data;
      const notes = [
        skipped > 0 ? `${skipped} skipped (no platform account set)` : null,
        offPreferredDays > 0 ? `${offPreferredDays} placed outside an account's posting days (month too full)` : null,
        doubledUp > 0 ? `${doubledUp} sharing a day on one account (more outputs than days)` : null,
      ].filter(Boolean);
      setMessage(`${assigned} assigned${notes.length > 0 ? ` — ${notes.join("; ")}` : ""}.`);
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
