"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { shareSignoffPack, deleteSignoffDraft } from "@/lib/actions/signoff";
import { signoffStatusMeta } from "@/lib/signoff-snapshot";
import { formatDate } from "@/lib/format";

export function SignoffPackCard({
  clientId,
  pack,
  children,
}: {
  clientId: string;
  pack: {
    id: string;
    version: number;
    status: string;
    created_at: string;
    approved_by_name: string;
    approved_at: string | null;
    client_comments: string;
  };
  children: React.ReactNode; // server-rendered SignoffSnapshotView
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = signoffStatusMeta(pack.status);

  function handleShare() {
    if (!window.confirm(`Share v${pack.version} with the client? It will appear in their portal for review.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await shareSignoffPack(clientId, pack.id);
      if (!result.ok) setError(result.message);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete draft v${pack.version}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSignoffDraft(clientId, pack.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">Version {pack.version}</span>
          <StatusPill label={meta.label} color={meta.color} />
          <span className="text-xs text-ink-faint">{formatDate(pack.created_at.slice(0, 10))}</span>
        </span>
        <span className="flex items-center gap-2">
          {pack.status === "draft" && (
            <>
              <Button size="sm" variant="primary" onClick={(e) => { e.preventDefault(); handleShare(); }} disabled={isPending}>
                Share with client
              </Button>
              <Button size="sm" variant="danger" onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isPending}>
                Delete
              </Button>
            </>
          )}
          <a
            href={`/api/signoff-pdf/${pack.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
          >
            Download PDF
          </a>
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {pack.status === "approved" && (
          <p className="text-sm text-success">
            Approved by {pack.approved_by_name || "the client"} on {formatDate(pack.approved_at?.slice(0, 10))} — this is
            the agreed baseline.
          </p>
        )}
        {pack.status === "changes_requested" && (
          <div className="rounded-md bg-danger-bg px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-danger">Client requested changes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-danger">{pack.client_comments || "No comment left."}</p>
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {children}
      </div>
    </details>
  );
}
