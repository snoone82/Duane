"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlatformMetrics } from "@/lib/actions/metrics";

/**
 * Remove one platform's metrics (Duane, clearing seeded data).
 *
 * The confirmation names the platform and counts what will go, because a
 * "platform metric" is really a stack of snapshots and targets — someone
 * clicking this should know they're deleting a history, not one row. There
 * is no undo, so the count is the honest thing to show.
 */
export function DeletePlatformMetricButton({
  clientId,
  platform,
  snapshotCount,
  targetCount,
}: {
  clientId: string;
  platform: string;
  snapshotCount: number;
  targetCount: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    const parts = [
      snapshotCount > 0 ? `${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"}` : null,
      targetCount > 0 ? `${targetCount} target${targetCount === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const detail = parts.length > 0 ? ` This removes ${parts.join(" and ")}, including the baseline and current figures.` : "";
    if (!window.confirm(`Delete all ${platform} metrics for this client?${detail} It can't be undone, and nothing else on the profile is affected.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deletePlatformMetrics(clientId, platform);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        aria-label={`Delete all ${platform} metrics`}
        title={`Delete all ${platform} metrics`}
        className="text-xs text-ink-faint underline-offset-2 transition-colors hover:text-danger hover:underline disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </>
  );
}
