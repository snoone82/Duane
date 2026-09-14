"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reconcileDueHandovers } from "@/lib/actions/publishing";

/**
 * Asks Ayrshare whether anything it was holding has actually gone out.
 *
 * This is the fix for the thing that caused Jonny's duplicates rather than a
 * nicety. A scheduled post published itself, but PBOS went on showing it as
 * pending because the only way to find out was pressing "Check status" on
 * that one row. So the screen said "not published" about a live post, and
 * the button next to it said "Publish now" — which made sending a second one
 * look like the right move.
 *
 * Runs once per mount, only when there is something whose time has passed,
 * and the action itself is throttled per output. Renders nothing unless it
 * actually changed something.
 */
export function ReconcileHandovers({ clientId, dueCount }: { clientId: string; dueCount: number }) {
  const router = useRouter();
  const started = useRef(false);
  const [checking, setChecking] = useState(false);
  const [published, setPublished] = useState(0);

  useEffect(() => {
    if (dueCount === 0 || started.current) return;
    started.current = true;
    setChecking(true);
    reconcileDueHandovers(clientId)
      .then((result) => {
        if (result.ok && (result.data ?? 0) > 0) {
          setPublished(result.data ?? 0);
          router.refresh();
        }
      })
      .finally(() => setChecking(false));
  }, [clientId, dueCount, router]);

  if (published > 0) {
    return (
      <p className="mb-3 rounded-md border border-border bg-surface-muted/60 px-3 py-2 text-xs text-ink-soft">
        <span className="font-medium text-ink">
          {published} post{published === 1 ? "" : "s"} had already gone out
        </span>{" "}
        — checked with Ayrshare and marked published here. Nothing was posted again.
      </p>
    );
  }

  if (checking) {
    return <p className="mb-3 text-xs text-ink-faint">Checking with Ayrshare whether scheduled posts have gone out…</p>;
  }

  return null;
}
