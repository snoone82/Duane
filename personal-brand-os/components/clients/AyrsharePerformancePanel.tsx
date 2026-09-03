"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { pullClientPerformance, reconcileAyrshareHistory } from "@/lib/actions/publishing";

/**
 * Performance from Ayrshare (Duane, 3 Sep 2026). Two read-only pulls:
 * matching recovers post ids for versions that were handed over before the
 * id was being recorded; pulling brings back views, reach, engagement,
 * likes, comments and shares for every published version that has an id.
 */
export function AyrsharePerformancePanel({
  clientId,
  publishedCount,
  withIdCount,
  lastPulledAt,
}: {
  clientId: string;
  publishedCount: number;
  withIdCount: number;
  lastPulledAt: string | null;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ label: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setNotice(null);
    setProblems([]);
    setError(null);
  }

  function match() {
    reset();
    startTransition(async () => {
      const result = await reconcileAyrshareHistory(clientId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { matched, unmatched, published } = result.data;
      setNotice(
        `${matched} version${matched === 1 ? "" : "s"} matched to Ayrshare posts` +
          (published > 0 ? `, ${published} marked published with the live link` : "") +
          (unmatched > 0 ? `. ${unmatched} couldn't be matched — those may not have been sent through PBOS.` : ".")
      );
    });
  }

  function pull() {
    reset();
    startTransition(async () => {
      const result = await pullClientPerformance(clientId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { updated, failed, remaining } = result.data;
      setNotice(
        `${updated} version${updated === 1 ? "" : "s"} updated from Ayrshare` +
          (remaining > 0 ? `. ${remaining} more to go — run it again.` : ".")
      );
      setProblems(failed);
    });
  }

  const missing = publishedCount - withIdCount;

  return (
    <div className="space-y-3 rounded-md border border-accent/30 bg-accent/5 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">Performance from Ayrshare</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          Read-only: pulls the views, reach, engagement, likes, comments and shares each network reports for posts
          published through PBOS. Nothing is posted or changed on the networks. TikTok and YouTube report nothing for the
          first day or two after publishing.
        </p>
      </div>
      <p className="text-xs text-ink-soft">
        {publishedCount} published version{publishedCount === 1 ? "" : "s"}, {withIdCount} with an Ayrshare id
        {missing > 0 ? ` — ${missing} without one` : ""}
        {lastPulledAt ? ` · last pulled ${new Date(lastPulledAt).toLocaleString("en-GB")}` : " · never pulled"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={pull} disabled={isPending || withIdCount === 0}>
          {isPending ? "Working…" : "Pull performance for published posts"}
        </Button>
        <Button variant="secondary" size="sm" onClick={match} disabled={isPending}>
          Match posts with Ayrshare
        </Button>
        <span className="text-xs text-ink-faint">
          Matching recovers the Ayrshare id for versions sent before ids were being recorded.
        </span>
      </div>
      {notice && <p className="text-xs text-success">{notice}</p>}
      {problems.length > 0 && (
        <ul className="space-y-0.5">
          {problems.map((p, i) => (
            <li key={i} className="text-xs text-ink-soft">
              <span className="font-medium text-ink">{p.label}</span>: {p.message}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
