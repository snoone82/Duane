import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProductionDays } from "@/lib/data/production";
import { AddProductionJobButton } from "@/components/production/AddProductionJobButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatDateTime } from "@/lib/format";
import { productionJobStatusMeta, productionAssetStatusMeta, productionAssetKindLabel, OUTSTANDING_ASSET_STATUSES } from "@/lib/status";

export const metadata = { title: "Production" };

/**
 * Production — what physically has to be made.
 *
 *   Content   decides what we are communicating
 *   Production turns that into things that must be filmed, shot or built
 *   Calendar   turns the finished assets into distribution
 *
 * Two views on one page rather than separate tabs (Duane): the production
 * days themselves, and every asset in flight across them. Opening a day
 * gives the run sheet.
 */
export default async function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [days, { data: assets }] = await Promise.all([
    getProductionDays(supabase, id),
    supabase
      .from("production_assets")
      .select("id,title,kind,status,owner_name,due_date,job_id,content_id")
      .eq("client_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const allAssets = assets ?? [];
  // Resolved separately rather than as an embed: the production tables are
  // new, and a hand-written relationship in the generated types would be one
  // more thing to keep in step with the schema.
  const { data: ideaTitles } = allAssets.length
    ? await supabase.from("content_ideas").select("id,title").in("id", [...new Set(allAssets.map((a) => a.content_id))])
    : { data: [] as { id: string; title: string }[] };
  const titleByIdea = new Map((ideaTitles ?? []).map((i) => [i.id, i.title]));
  const outstanding = allAssets.filter((a) => (OUTSTANDING_ASSET_STATUSES as string[]).includes(a.status));
  const jobTitles = new Map(days.map((d) => [d.id, d.title]));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Production days</h2>
          <AddProductionJobButton clientId={id} />
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          A filming, photography or design session. Attach the approved Master Content being produced that day and open it
          for the run sheet. Production points at the content records — it never copies them.
        </p>
        {days.length === 0 ? (
          <EmptyState
            title="No production days yet"
            description="Once the month's content is agreed, add the day you'll film or shoot it and attach the pieces being produced."
          />
        ) : (
          <ul className="space-y-2">
            {days.map((day) => {
              const meta = productionJobStatusMeta(day.status);
              return (
                <li key={day.id}>
                  <Link
                    href={`/clients/${id}/production/${day.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{day.title}</span>
                      <span className="block text-xs text-ink-soft">
                        {day.scheduledAt ? formatDateTime(day.scheduledAt) : formatDate(day.productionDate)}
                        {day.location && <span className="text-ink-faint"> · {day.location}</span>}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-3">
                      <span className="text-xs text-ink-faint">
                        {day.ideaCount} idea{day.ideaCount === 1 ? "" : "s"} · {day.assetCount} asset
                        {day.assetCount === 1 ? "" : "s"}
                        {day.outstanding > 0 && <span className="text-amber-500"> · {day.outstanding} outstanding</span>}
                      </span>
                      <StatusPill label={meta.label} color={meta.color} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">
          Everything in production
          {outstanding.length > 0 && <span className="ml-2 font-normal text-ink-soft">{outstanding.length} outstanding</span>}
        </h2>
        {allAssets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-ink-faint">
            No assets yet. Open a production day and add what needs making.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {allAssets.map((asset) => {
              const meta = productionAssetStatusMeta(asset.status);
              return (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{asset.title}</span>
                    <span className="block text-xs text-ink-faint">
                      {productionAssetKindLabel(asset.kind)}
                      {titleByIdea.get(asset.content_id) && <span> · {titleByIdea.get(asset.content_id)}</span>}
                      {asset.job_id && jobTitles.has(asset.job_id) && <span> · {jobTitles.get(asset.job_id)}</span>}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-3">
                    {asset.owner_name && <span className="text-xs text-ink-faint">{asset.owner_name}</span>}
                    {asset.due_date && <span className="text-xs text-ink-faint">due {formatDate(asset.due_date)}</span>}
                    <StatusPill label={meta.label} color={meta.color} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
