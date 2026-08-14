import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformMetrics, getScorecard, getContentMetrics } from "@/lib/data/metrics";
import { AddMetricSnapshotButton } from "@/components/clients/AddMetricSnapshotButton";
import { AddMetricTargetButton } from "@/components/clients/AddMetricTargetButton";
import { AddScorecardEntryButton } from "@/components/clients/AddScorecardEntryButton";
import { AddCommercialOutcomeButton } from "@/components/clients/AddCommercialOutcomeButton";
import { AddCommercialSnapshotButton } from "@/components/clients/AddCommercialSnapshotButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/Table";
import { formatNumber, formatDate, formatCurrency } from "@/lib/format";

export const metadata = { title: "Metrics" };

function Movement({ latest, previous }: { latest: number | null; previous: number | null }) {
  if (latest === null || previous === null) return null;
  const delta = latest - previous;
  if (delta === 0) return <span className="text-xs text-ink-faint">No change</span>;
  const up = delta > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

const DETAIL_METRICS: { key: "follower_growth" | "impressions" | "reach" | "engagement" | "profile_visits" | "video_views" | "comments" | "shares" | "saves"; label: string }[] = [
  { key: "follower_growth", label: "Follower growth" },
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "engagement", label: "Engagement" },
  { key: "profile_visits", label: "Profile visits" },
  { key: "video_views", label: "Video views" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
];

export default async function MetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [platformMetrics, scorecard, contentMetrics, { data: outcomes }, { data: commercialSnapshots }] = await Promise.all([
    getPlatformMetrics(supabase, id),
    getScorecard(supabase, id),
    getContentMetrics(supabase, id),
    supabase.from("commercial_outcomes").select("*").eq("client_id", id).order("outcome_date", { ascending: false }),
    supabase.from("commercial_snapshots").select("*").eq("client_id", id).order("period_date", { ascending: false }),
  ]);

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Platform metrics</h2>
          <div className="flex gap-2">
            <AddMetricTargetButton clientId={id} />
            <AddMetricSnapshotButton clientId={id} />
          </div>
        </div>
        {platformMetrics.length === 0 ? (
          <EmptyState title="No metrics yet" description="Add the first snapshot to start tracking baseline → current → target." />
        ) : (
          <>
            <Table>
              <Thead>
                <tr>
                  <Th>Platform</Th>
                  <Th>Baseline</Th>
                  <Th>Current (followers)</Th>
                  <Th>Target</Th>
                  <Th>As of</Th>
                </tr>
              </Thead>
              <tbody>
                {platformMetrics.map((metric) => (
                  <Tr key={metric.platform}>
                    <Td className="font-medium text-ink">{metric.platform}</Td>
                    <Td className="text-ink-soft">{formatNumber(metric.baseline)}</Td>
                    <Td className="font-medium text-ink">{formatNumber(metric.current)}</Td>
                    <Td className="text-ink-soft">
                      {formatNumber(metric.target)}
                      {metric.targetDate && <span className="ml-1 text-xs text-ink-faint">by {formatDate(metric.targetDate)}</span>}
                    </Td>
                    <Td className="text-ink-faint">{formatDate(metric.currentDate)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-3 space-y-2">
              {platformMetrics
                .filter((m) => m.latestSnapshot)
                .map((metric) => (
                  <details key={metric.platform} className="group rounded-lg border border-border bg-surface">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-medium text-ink-soft">
                      <span className="text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
                      {metric.platform} — full breakdown ({formatDate(metric.latestSnapshot!.snapshot_date)})
                    </summary>
                    <div className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-3">
                      {DETAIL_METRICS.map((d) => (
                        <div key={d.key}>
                          <p className="text-xs text-ink-faint">{d.label}</p>
                          <p className="text-sm text-ink">{formatNumber(metric.latestSnapshot![d.key])}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Content metrics</h2>
        <p className="mb-3 text-xs text-ink-faint">Derived from published/measured content ideas — add a reach/engagement number to a content idea once it&rsquo;s measured to feed this.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-ink-faint">Posts published</p>
            <p className="text-lg font-semibold text-ink">{contentMetrics.postsPublished}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-ink-faint">Average reach</p>
            <p className="text-lg font-semibold text-ink">{formatNumber(contentMetrics.averageReach)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-ink-faint">Average engagement</p>
            <p className="text-lg font-semibold text-ink">{formatNumber(contentMetrics.averageEngagement)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-xs text-ink-faint">Most successful pillar</p>
            <p className="text-sm font-semibold text-ink">{contentMetrics.topPillar?.name ?? "—"}</p>
          </div>
        </div>
        {contentMetrics.topContent.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Highest-performing content</p>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {contentMetrics.topContent.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${id}/content`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-surface-muted">
                    <span className="truncate text-ink">{c.title}</span>
                    <span className="flex-shrink-0 text-ink-faint">{formatNumber(c.reach)} reach</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Commercial metrics</h2>
          <AddCommercialSnapshotButton clientId={id} />
        </div>
        <p className="mb-2 text-xs text-ink-faint">Internal only — periodic structured counts.</p>
        {!commercialSnapshots || commercialSnapshots.length === 0 ? (
          <EmptyState title="No commercial metrics logged yet" description="Add leads, enquiries, calls, customers and revenue for a period to start tracking." />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Leads</Th>
                <Th>Enquiries</Th>
                <Th>Sales calls</Th>
                <Th>New customers</Th>
                <Th>Opportunities</Th>
                <Th>Revenue</Th>
              </tr>
            </Thead>
            <tbody>
              {commercialSnapshots.map((row) => (
                <Tr key={row.id}>
                  <Td className="text-ink-soft">{formatDate(row.period_date)}</Td>
                  <Td className="text-ink">{formatNumber(row.leads_generated)}</Td>
                  <Td className="text-ink">{formatNumber(row.enquiries)}</Td>
                  <Td className="text-ink">{formatNumber(row.sales_calls)}</Td>
                  <Td className="text-ink">{formatNumber(row.new_customers)}</Td>
                  <Td className="text-ink">{formatNumber(row.opportunities_generated)}</Td>
                  <Td className="font-medium text-ink">{formatCurrency(row.revenue_attributed)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Commercial outcomes</h2>
          <AddCommercialOutcomeButton clientId={id} />
        </div>
        <p className="mb-2 text-xs text-ink-faint">Internal only — a plain log of individual wins, not a running total.</p>
        {!outcomes || outcomes.length === 0 ? (
          <EmptyState title="No outcomes logged yet" description="Log a result attributed to the brand work — a deal, a speaking fee, a converted lead." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {outcomes.map((outcome) => (
              <li key={outcome.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{outcome.description}</p>
                  <p className="text-xs text-ink-faint">
                    {formatDate(outcome.outcome_date)}
                    {outcome.source && ` · ${outcome.source}`}
                  </p>
                </div>
                {outcome.value !== null && <span className="flex-shrink-0 text-sm font-medium text-ink">{formatCurrency(outcome.value)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Scorecard</h2>
          <AddScorecardEntryButton clientId={id} />
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Category</Th>
              <Th>Latest</Th>
              <Th>Previous</Th>
              <Th>Movement</Th>
              <Th>As of</Th>
            </tr>
          </Thead>
          <tbody>
            {scorecard.map((row) => (
              <Tr key={row.category}>
                <Td className="text-ink">{row.category}</Td>
                <Td className="font-medium text-ink">{row.latest === null ? "—" : row.latest.toFixed(1)}</Td>
                <Td className="text-ink-soft">{row.previous === null ? "—" : row.previous.toFixed(1)}</Td>
                <Td>
                  <Movement latest={row.latest} previous={row.previous} />
                </Td>
                <Td className="text-ink-faint">{formatDate(row.latestDate)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
