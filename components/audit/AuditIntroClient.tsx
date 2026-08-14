"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startOrResumeAudit } from "@/app/actions/audit";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * The audit itself isn't created until this is clicked — someone who reads
 * the intro and leaves shouldn't end up with a stray in-progress audit row.
 */
export function AuditIntroClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBegin() {
    setError(null);
    startTransition(async () => {
      const result = await startOrResumeAudit();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/audit");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={handleBegin} loading={isPending} loadingText="One moment…" className="w-full">
        Begin the Audit
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
