"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startOrResumeClearPlan } from "@/app/actions/clear";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { CLEAR_STEP_TITLES } from "@/lib/clear-steps";

/**
 * The CLEAR plan isn't created until "Begin CLEAR" is clicked — same
 * reasoning as AuditIntroClient: reading the framework overview and
 * leaving shouldn't leave a stray in-progress row.
 */
export function ClearIntroClient({
  auditId,
  lifeAreaId,
  lifeAreaName,
}: {
  auditId: string;
  lifeAreaId: string;
  lifeAreaName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBegin() {
    setError(null);
    startTransition(async () => {
      const result = await startOrResumeClearPlan({ auditId, lifeAreaId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {Object.entries(CLEAR_STEP_TITLES).map(([step, { letter, title }]) => (
          <div key={step} className="rounded-md border border-border bg-paper-raised p-3">
            <p className="font-heading text-lg text-gold-strong">{letter}</p>
            <p className="mt-1 text-sm font-medium text-ink">{title}</p>
          </div>
        ))}
      </div>

      <p className="text-base leading-snug text-ink-soft">
        CLEAR is the bridge between awareness and action — five short steps for{" "}
        <span className="font-medium text-ink">{lifeAreaName}</span>, ending with one clear goal
        you&apos;ll actually track for the next 30 days.
      </p>

      <div>
        <Button onClick={handleBegin} loading={isPending} loadingText="One moment…" className="w-full">
          Begin CLEAR
        </Button>
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
