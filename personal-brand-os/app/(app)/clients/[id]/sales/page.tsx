import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientCommercialProgress } from "@/lib/data/sales";
import { SalesStrategyForm } from "@/components/clients/SalesStrategyForm";
import { ProgressRing } from "@/components/dashboard/Charts";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Sales" };

/** The CLIENT's commercial area: what they sell, who to, how the brand turns
 * attention into revenue, and how they're doing against their own target.
 * Everything here belongs to them. What they pay Aligned Media for PBOS is a
 * different question entirely and lives on the PBOS Sales screen. */
export default async function ClientSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS: sales_strategy is strategic-tier — contractors get no row back and
  // land on the 404, same as Vision/Positioning.
  const { data: strategy } = await supabase.from("sales_strategy").select("*").eq("client_id", id).maybeSingle();
  if (!strategy) notFound();

  const progress = await getClientCommercialProgress(supabase, id);
  const percent =
    progress.monthlyTarget && progress.monthlyTarget > 0
      ? Math.min(100, Math.round((progress.valueThisMonth / progress.monthlyTarget) * 100))
      : null;

  const snapshot = progress.latestSnapshot;
  const snapshotFigures = snapshot
    ? [
        { label: "Leads", value: snapshot.leads_generated },
        { label: "Enquiries", value: snapshot.enquiries },
        { label: "Sales calls", value: snapshot.sales_calls },
        { label: "Opportunities", value: snapshot.opportunities_generated },
        { label: "New customers", value: snapshot.new_customers },
        { label: "Revenue attributed", value: snapshot.revenue_attributed, isMoney: true },
      ].filter((figure) => figure.value !== null)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-ink-soft">
        How this personal brand turns visibility into revenue for them — Visibility → Authority → Trust → Opportunity →
        Revenue. Saves as you go.
      </p>

      {/* Progress against their own target */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Their month so far</p>
          {percent !== null ? (
            <ProgressRing
              percent={percent}
              centre={`${percent}%`}
              caption={`${formatCurrency(progress.valueThisMonth)} of ${formatCurrency(progress.monthlyTarget)} this month`}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
              <p className="text-2xl font-light tabular-nums text-ink">{formatCurrency(progress.valueThisMonth)}</p>
              <p className="text-xs text-ink-faint">
                logged this month · set a monthly target below to track progress
              </p>
            </div>
          )}
          <p className="mt-3 border-t border-border pt-2 text-xs text-ink-faint">
            {progress.outcomesThisMonth} outcome{progress.outcomesThisMonth === 1 ? "" : "s"} this month ·{" "}
            {formatCurrency(progress.valueLast12Months)} in the last 12 months
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
            Latest commercial snapshot
            {snapshot && <span className="ml-2 normal-case text-ink-faint">{formatDate(snapshot.period_date)}</span>}
          </p>
          {snapshotFigures.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {snapshotFigures.map((figure) => (
                <div key={figure.label}>
                  <dt className="text-xs text-ink-faint">{figure.label}</dt>
                  <dd className="text-lg font-light tabular-nums text-ink">
                    {figure.isMoney ? formatCurrency(figure.value) : formatNumber(figure.value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-ink-faint">
              No snapshot recorded yet — leads, enquiries, opportunities and revenue are logged on the{" "}
              <Link href={`/clients/${id}/metrics`} className="text-accent underline-offset-2 hover:underline">
                Metrics tab
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* Recent commercial outcomes — the log, not a chart. */}
      {progress.recentOutcomes.length > 0 && (
        <section className="rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
          <p className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
            Recent commercial outcomes
          </p>
          <ul className="divide-y divide-border">
            {progress.recentOutcomes.map((outcome) => (
              <li key={outcome.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{outcome.description}</span>
                  {outcome.source && <span className="ml-2 text-xs text-ink-faint">via {outcome.source}</span>}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="tabular-nums text-ink">{outcome.value !== null ? formatCurrency(outcome.value) : "—"}</span>
                  <span className="text-xs text-ink-faint">{formatDate(outcome.outcome_date)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-2 text-xs text-ink-faint">
            Logged on the{" "}
            <Link href={`/clients/${id}/metrics`} className="text-accent underline-offset-2 hover:underline">
              Metrics tab
            </Link>
            . Internal only — nothing here is visible to the client.
          </p>
        </section>
      )}

      <SalesStrategyForm clientId={id} strategy={strategy} />
    </div>
  );
}
