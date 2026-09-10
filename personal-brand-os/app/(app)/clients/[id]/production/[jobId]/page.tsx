import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRunSheet } from "@/lib/data/production";
import { ProductionAssetRow } from "@/components/production/ProductionAssetRow";
import { AddProductionAssetButton } from "@/components/production/AddProductionAssetButton";
import { AttachIdeasButton } from "@/components/production/AttachIdeasButton";
import { JobStatusControl } from "@/components/production/JobStatusControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatDateTime, socialAccountLabel } from "@/lib/format";

export const metadata = { title: "Production day" };

/**
 * The run sheet — what Duane called the most useful operational screen.
 *
 * Everything on it is read from the Master Ideas attached to the day and the
 * assets made from them. The three lines that matter on a shoot are Hook,
 * Brief and Finish, exactly as he sketched, and each asset shows which
 * platform versions it feeds so one filming job is visibly one job rather
 * than four.
 */
export default async function ProductionDayPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await params;
  const supabase = await createClient();
  const sheet = await getRunSheet(supabase, id, jobId);
  if (!sheet) notFound();

  // Approved content not yet on any day — what can still be attached.
  const { data: available } = await supabase
    .from("content_ideas")
    .select("id,title,status")
    .eq("client_id", id)
    .in("status", ["approved_production", "in_production", "ready_for_approval", "changes_requested"])
    .order("title");
  const attachedIds = new Set(sheet.ideas.map((i) => i.id));
  const attachable = (available ?? []).filter((i) => !attachedIds.has(i.id));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/clients/${id}/production`} className="text-xs text-accent underline-offset-2 hover:underline">
          ← All production days
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ink">{sheet.job.title}</h1>
          <JobStatusControl clientId={id} jobId={jobId} status={sheet.job.status} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {sheet.job.scheduledAt ? formatDateTime(sheet.job.scheduledAt) : formatDate(sheet.job.productionDate)}
          {sheet.job.location && <span className="text-ink-faint"> · {sheet.job.location}</span>}
        </p>
        {sheet.job.notes && <p className="mt-2 text-sm text-ink-soft">{sheet.job.notes}</p>}
        <p className="mt-2 text-xs text-ink-faint">
          {sheet.totals.ideas} idea{sheet.totals.ideas === 1 ? "" : "s"} · {sheet.totals.assets} asset
          {sheet.totals.assets === 1 ? "" : "s"}
          {sheet.totals.outstanding > 0 && ` · ${sheet.totals.outstanding} still to finish`}
          {sheet.totals.outputsServed > 0 && ` · feeding ${sheet.totals.outputsServed} platform version${sheet.totals.outputsServed === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Run sheet</h2>
        <div className="flex items-center gap-2">
          {sheet.ideas.length > 0 && (
            <Link
              href={`/clients/${id}/production/${jobId}/run-sheet`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              Open crew run sheet →
            </Link>
          )}
          <AttachIdeasButton clientId={id} jobId={jobId} available={attachable} />
        </div>
      </div>

      {sheet.ideas.length === 0 ? (
        <EmptyState
          title="Nothing attached to this day yet"
          description="Add the approved Master Content being produced, and the run sheet builds itself from those records."
        />
      ) : (
        <ol className="space-y-4">
          {sheet.ideas.map((idea, index) => (
            <li key={idea.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">
                  <span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, "0")}</span>{" "}
                  {idea.title}
                </h3>
                {idea.pillarName && (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">{idea.pillarName}</span>
                )}
              </div>
              {idea.hook && <p className="mt-1.5 text-sm text-ink">{idea.hook}</p>}
              {idea.body && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{idea.body}</p>}
              {idea.cta && (
                <p className="mt-1 text-xs text-ink-soft">
                  <span className="text-ink-faint">CTA · </span>
                  {idea.cta}
                </p>
              )}

              {idea.assets.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {idea.assets.map((asset) => (
                    <ProductionAssetRow key={asset.id} clientId={id} asset={asset} />
                  ))}
                </ul>
              )}

              {idea.unservedOutputs.length > 0 && (
                <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">Nothing being made for: </span>
                  {idea.unservedOutputs
                    .map((o) => `${socialAccountLabel(o.platform, o.accountName)}${o.format ? ` · ${o.format}` : ""}`)
                    .join(", ")}
                  . These versions are planned to publish but no asset feeds them yet.
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <AddProductionAssetButton clientId={id} jobId={jobId} contentId={idea.id} contentTitle={idea.title} />
                <Link href={`/clients/${id}/content`} className="text-xs text-accent underline-offset-2 hover:underline">
                  Open in Content →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
