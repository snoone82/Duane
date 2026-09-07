"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Input, Label } from "@/components/ui/Input";
import { approveMonthlyPlan, reapproveMonthlyPlan, withdrawApproval } from "@/lib/actions/client-view";
import { formatDate } from "@/lib/format";

/**
 * Approving the month — against a specific version of it.
 *
 * Duane: approval must be tied to the version approved, not just a date. So
 * "Approved" here always names a revision, and a client-visible change
 * afterwards shows as no longer covered until someone re-confirms it.
 * Approve is only offered once publish dates exist: the client is signing
 * off a schedule, not a list.
 */
export function ApproveMonthPanel({
  clientId,
  planId,
  approvedAt,
  approvedRevision,
  changedSinceApproval,
  canApprove,
  blockedReason,
}: {
  clientId: string;
  planId: string;
  approvedAt: string | null;
  approvedRevision: number | null;
  changedSinceApproval: boolean;
  canApprove: boolean;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.message ?? "That didn't work.");
      else router.refresh();
    });
  }

  if (approvedAt) {
    return (
      <section
        className={`rounded-lg border p-4 ${changedSinceApproval ? "border-amber-500/40 bg-amber-500/10" : "border-success/40 bg-success/10"}`}
      >
        {error && <Notice kind="danger">{error}</Notice>}
        <p className="text-sm font-semibold text-ink">
          {changedSinceApproval ? "Changed since approval" : "Approved"}
          {approvedRevision !== null && <span className="font-normal text-ink-soft"> · revision {approvedRevision}</span>}
          <span className="font-normal text-ink-soft"> · {formatDate(approvedAt.slice(0, 10))}</span>
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {changedSinceApproval
            ? "Something the client signed off — a title, hook, summary, CTA, platform, format or publish date — has changed since. The approval no longer covers what's on screen. Internal production notes don't affect this."
            : "This is the version the client approved. If a client-visible field changes, this will say so."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {changedSinceApproval && (
            <Button variant="primary" disabled={isPending} onClick={() => run(() => reapproveMonthlyPlan(clientId, planId))}>
              {isPending ? "Saving…" : "Re-confirm this version"}
            </Button>
          )}
          <Button variant="ghost" disabled={isPending} onClick={() => run(() => withdrawApproval(clientId, planId))}>
            Withdraw approval
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      {error && <Notice kind="danger">{error}</Notice>}
      <h2 className="text-sm font-semibold text-ink">Approve the month</h2>
      {blockedReason ? (
        <p className="mt-1 text-xs text-ink-soft">{blockedReason}</p>
      ) : (
        <p className="mt-1 text-xs text-ink-soft">
          Records this exact version as the one signed off. A later change to anything the client can see will show as no
          longer covered.
        </p>
      )}
      {canApprove && (
        <div className="mt-3 space-y-2">
          <div>
            <Label htmlFor="approval_note">Note (optional)</Label>
            <Input
              id="approval_note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Approved on the call, 7 Sept"
              disabled={isPending}
            />
          </div>
          <Button variant="primary" disabled={isPending} onClick={() => run(() => approveMonthlyPlan(clientId, planId, note))}>
            {isPending ? "Saving…" : "Approve month"}
          </Button>
        </div>
      )}
    </section>
  );
}
