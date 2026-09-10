import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRunSheet } from "@/lib/data/production";
import { PrintButton } from "@/components/production/PrintButton";
import { formatDate, formatDateTime, socialAccountLabel } from "@/lib/format";
import { productionAssetKindLabel } from "@/lib/status";

export const metadata = { title: "Run sheet" };

/**
 * The run sheet as an actual output (Duane: "this is the big missing piece").
 *
 * Built to be worked through on the day and to print cleanly — no
 * navigation, no controls, no status dropdowns. Each asset reads Hook →
 * Brief → Finish with a tick box beside it, which is exactly how a shoot
 * runs: do the thing, mark it captured, move on.
 *
 * Nothing operator-internal appears except the production notes, which are
 * the crew's own. There is no client here — this is the working document.
 */
export default async function CrewRunSheetPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await params;
  const supabase = await createClient();
  const [sheet, { data: client }] = await Promise.all([
    getRunSheet(supabase, id, jobId),
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
  ]);
  if (!sheet) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      {/* Screen-only chrome. Everything below prints. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/clients/${id}/production/${jobId}`} className="text-xs text-accent underline-offset-2 hover:underline">
          ← Back to the production day
        </Link>
        <PrintButton />
      </div>

      <header className="mb-6 border-b-2 border-ink pb-3">
        <h1 className="text-2xl font-semibold text-ink">{sheet.job.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {client?.name}
          {" · "}
          {sheet.job.scheduledAt ? formatDateTime(sheet.job.scheduledAt) : formatDate(sheet.job.productionDate)}
          {sheet.job.location && ` · ${sheet.job.location}`}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          {sheet.totals.ideas} to produce · {sheet.totals.assets} asset{sheet.totals.assets === 1 ? "" : "s"} · feeding{" "}
          {sheet.totals.outputsServed} platform version{sheet.totals.outputsServed === 1 ? "" : "s"}
        </p>
        {sheet.job.notes && <p className="mt-2 text-sm text-ink-soft">{sheet.job.notes}</p>}
      </header>

      <ol className="space-y-6">
        {sheet.ideas.map((idea, index) => (
          <li key={idea.id} className="break-inside-avoid border-b border-border pb-5 last:border-b-0">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="text-lg font-semibold uppercase tracking-tight text-ink">{idea.title}</h2>
            </div>
            {idea.pillarName && <p className="ml-9 text-xs text-ink-faint">{idea.pillarName}</p>}
            {idea.cta && (
              <p className="ml-9 mt-1 text-sm text-ink-soft">
                <span className="text-xs uppercase tracking-wide text-ink-faint">CTA · </span>
                {idea.cta}
              </p>
            )}

            {idea.assets.length === 0 ? (
              <p className="ml-9 mt-2 text-sm text-ink-faint">
                Nothing listed to make for this one — add an asset before the day.
              </p>
            ) : (
              <div className="ml-9 mt-3 space-y-4">
                {idea.assets.map((asset) => (
                  <div key={asset.id} className="flex gap-3">
                    {/* A real box, because this gets printed and ticked. */}
                    <span
                      aria-hidden
                      className="mt-0.5 h-4 w-4 flex-none rounded-sm border-2 border-ink-faint print:border-black"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {asset.title}
                        <span className="ml-2 font-normal text-ink-faint">{productionAssetKindLabel(asset.kind)}</span>
                      </p>

                      {asset.hook && (
                        <p className="mt-1.5 text-sm text-ink">
                          <span className="text-xs uppercase tracking-wide text-ink-faint">Hook · </span>
                          {asset.hook}
                        </p>
                      )}
                      {asset.brief && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                          <span className="text-xs uppercase tracking-wide text-ink-faint">Brief · </span>
                          {asset.brief}
                        </p>
                      )}
                      {asset.finishCta && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                          <span className="text-xs uppercase tracking-wide text-ink-faint">Finish · </span>
                          {asset.finishCta}
                        </p>
                      )}
                      {asset.productionNotes && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink-faint">{asset.productionNotes}</p>
                      )}

                      {asset.feeds.length > 0 && (
                        <p className="mt-1.5 text-xs text-ink-faint">
                          For: {asset.feeds.map((o) => socialAccountLabel(o.platform, o.accountName)).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {sheet.ideas.length === 0 && (
        <p className="text-sm text-ink-faint">Nothing attached to this day yet.</p>
      )}
    </div>
  );
}
