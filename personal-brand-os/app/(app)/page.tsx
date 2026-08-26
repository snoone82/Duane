import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getActionsDue,
  getMeetingsThisWeek,
  getContentAwaitingApproval,
  getAttentionFlags,
  getRosterOverview,
  getClientProgress,
  getRecentActivity,
  getOpenOpportunities,
  getContentPipelineSummary,
} from "@/lib/data/dashboard";
import { getSalesOverview } from "@/lib/data/sales";
import { getCurrentProfile } from "@/lib/current-user";
import { Panel } from "@/components/dashboard/Panel";
import { ProgressRing, Donut, HBars } from "@/components/dashboard/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeToToday, formatCurrency, formatDateTime, auditVerb } from "@/lib/format";
import { authorityStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === "admin";

  const [actionsDue, meetings, contentGroups, attentionFlags, roster, clientProgress, openOpportunities, recentActivity, pipeline] = await Promise.all([
    getActionsDue(supabase),
    getMeetingsThisWeek(supabase),
    getContentAwaitingApproval(supabase),
    getAttentionFlags(supabase),
    getRosterOverview(supabase),
    getClientProgress(supabase),
    getOpenOpportunities(supabase),
    isAdmin ? getRecentActivity(supabase) : Promise.resolve([]),
    getContentPipelineSummary(supabase),
  ]);
  const sales = await getSalesOverview(supabase);

  const overdueCount = actionsDue.filter((a) => a.isOverdue).length;
  const totalIdeas = contentGroups.reduce((sum, g) => sum + g.ideas.length, 0);

  // Greeting in the workspace's own timezone, not the server's.
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date())
  );
  const greeting = londonHour < 12 ? "Good morning" : londonHour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (currentProfile?.full_name || "").split(" ")[0] || null;
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date());

  const salesProgress =
    sales.monthlyTarget !== null && sales.monthlyTarget > 0
      ? Math.min(100, Math.round((sales.actualThisMonth / sales.monthlyTarget) * 100))
      : null;

  const stats: {
    label: string;
    value: string;
    detail: string;
    href?: string;
    tone: "teal" | "violet" | "danger" | "plain";
    progress?: number | null;
  }[] = [
    { label: "Active clients", value: String(roster.activeCount), detail: `${roster.totalCount} total`, tone: "teal" },
    {
      label: "Monthly retainers",
      value: formatCurrency(roster.monthlyRetainerTotal),
      detail: `${roster.clientsWithRetainer} client${roster.clientsWithRetainer === 1 ? "" : "s"}`,
      tone: "violet",
    },
    {
      label: "Sales this month",
      value: formatCurrency(sales.actualThisMonth),
      detail: sales.monthlyTarget !== null ? `of ${formatCurrency(sales.monthlyTarget)} target` : "Set a target →",
      href: "/sales",
      tone: "teal",
    },
    {
      label: "Actions overdue",
      value: String(overdueCount),
      detail: `${actionsDue.length} due in total`,
      href: "/actions",
      tone: overdueCount > 0 ? "danger" : "plain",
    },
    {
      label: "Open opportunities",
      value: String(openOpportunities.length),
      detail: "across all clients",
      tone: "violet",
    },
  ];

  const toneBar: Record<string, string> = {
    teal: "linear-gradient(90deg, #21c9e0, transparent)",
    violet: "linear-gradient(90deg, #8b5cf6, transparent)",
    danger: "linear-gradient(90deg, #ff7a70, transparent)",
    plain: "linear-gradient(90deg, #38537a, transparent)",
  };

  // Pipeline mix donut — five stages, colour-vision-validated slot order.
  const pipelineSegments = [
    { label: "In production", value: pipeline.awaitingProduction, color: "#3987e5" },
    { label: "Awaiting approval", value: pipeline.awaitingApproval, color: "#d95926" },
    { label: "Changes requested", value: pipeline.changesRequested, color: "#199e70" },
    { label: "Ready to schedule", value: pipeline.readyToSchedule, color: "#c98500" },
    { label: "Scheduled (7 days)", value: pipeline.scheduledNext7Days, color: "#d55181" },
  ];
  const pipelineTotal = pipelineSegments.reduce((sum, s) => sum + s.value, 0);

  // Workload bars — open due actions grouped by client, busiest first.
  const workloadByClient = new Map<string, { label: string; total: number; overdue: number; clientId: string }>();
  for (const action of actionsDue) {
    const row = workloadByClient.get(action.clientId) ?? { label: action.clientName, total: 0, overdue: 0, clientId: action.clientId };
    row.total += 1;
    if (action.isOverdue) row.overdue += 1;
    workloadByClient.set(action.clientId, row);
  }
  const workload = [...workloadByClient.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((row) => ({
      label: row.label,
      value: row.total,
      detail: row.overdue > 0 ? `(${row.overdue} overdue)` : undefined,
      detailDanger: row.overdue > 0,
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">
            {greeting}
            {firstName ? (
              <>
                , <span className="bg-gradient-to-r from-accent to-[#8b5cf6] bg-clip-text font-normal text-transparent">{firstName}</span>
              </>
            ) : null}
            .
          </h1>
          <p className="mt-1 text-sm font-light text-ink-soft">Here&rsquo;s where every client stands right now.</p>
        </div>
        <p className="text-sm font-light text-ink-faint">{today}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const inner = (
            <>
              <div className="mb-3 h-px w-full" style={{ background: toneBar[stat.tone] }} />
              <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">{stat.label}</p>
              <p className={`mt-1 text-2xl font-light tabular-nums ${stat.tone === "danger" ? "text-danger" : "text-ink"}`}>
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">{stat.detail}</p>
              {stat.progress !== null && stat.progress !== undefined && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${stat.progress}%`, background: "linear-gradient(90deg, #21c9e0, #8b5cf6)" }}
                  />
                </div>
              )}
            </>
          );
          const cardClass =
            "rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm transition-colors duration-150";
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className={`${cardClass} hover:border-accent/60`}>
              {inner}
            </Link>
          ) : (
            <div key={stat.label} className={cardClass}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Sales target</p>
          {sales.monthlyTarget !== null && sales.monthlyTarget > 0 ? (
            <ProgressRing
              percent={salesProgress ?? 0}
              centre={`${salesProgress ?? 0}%`}
              caption={`${formatCurrency(sales.actualThisMonth)} of ${formatCurrency(sales.monthlyTarget)} this month`}
            />
          ) : (
            <div className="flex h-40 items-center justify-center">
              <Link href="/sales" className="text-sm text-accent underline-offset-2 hover:underline">
                Set a monthly target →
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Pipeline mix</p>
          {pipelineTotal > 0 ? (
            <Donut segments={pipelineSegments} centreLabel="in play" />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">Nothing in the pipeline yet.</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm sm:col-span-2 lg:col-span-1">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Actions due by client</p>
          {workload.length > 0 ? (
            <HBars items={workload} />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">Nothing due right now.</p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Content pipeline · all clients</p>
          <Link href="/calendar" className="text-xs text-accent underline-offset-2 hover:underline">
            Open calendar →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "In production", value: pipeline.awaitingProduction },
            { label: "Awaiting approval", value: pipeline.awaitingApproval },
            { label: "Changes requested", value: pipeline.changesRequested, danger: pipeline.changesRequested > 0 },
            { label: "Ready to schedule", value: pipeline.readyToSchedule },
            { label: "Scheduled (7 days)", value: pipeline.scheduledNext7Days },
            { label: "Published (7 days)", value: pipeline.publishedLast7Days },
            { label: "Overdue / missed", value: pipeline.overdueScheduled, danger: pipeline.overdueScheduled > 0 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-md py-1.5">
              <p className={`text-2xl font-light tabular-nums ${stat.danger ? "text-danger" : "text-ink"}`}>{stat.value}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Actions due" count={actionsDue.length}>
          {actionsDue.length === 0 ? (
            <EmptyState title="Nothing due" description="No open actions have a due date right now." />
          ) : (
            <ul className="divide-y divide-border">
              {actionsDue.map((action) => (
                <li key={action.id}>
                  <Link
                    href={`/clients/${action.clientId}/actions`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{action.title}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {action.clientName} · {action.ownerLabel}
                      </span>
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs font-medium ${action.isOverdue ? "text-danger" : "text-ink-soft"}`}
                    >
                      {action.isOverdue ? "Overdue" : formatRelativeToToday(action.dueDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {overdueCount > 0 && (
            <p className="px-2 pt-2 text-xs text-danger">{overdueCount} overdue</p>
          )}
        </Panel>

        <Panel title="Meetings this week" count={meetings.length}>
          {meetings.length === 0 ? (
            <EmptyState title="No meetings scheduled" description="Nothing on the calendar for the next 7 days." />
          ) : (
            <ul className="divide-y divide-border">
              {meetings.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/clients/${meeting.clientId}/consultations`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="truncate text-sm text-ink">{meeting.clientName}</span>
                    <span className="flex-shrink-0 text-xs font-medium text-ink-soft">
                      {formatRelativeToToday(meeting.nextMeetingDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Content awaiting approval" count={totalIdeas}>
          {contentGroups.length === 0 ? (
            <EmptyState title="Nothing waiting" description="No ideas are sitting in the idea stage." />
          ) : (
            <ul className="space-y-2">
              {contentGroups.map((group) => (
                <li key={group.clientId} className="rounded-md px-2 py-1.5">
                  <Link href={`/clients/${group.clientId}/content`} className="text-sm font-medium text-ink hover:underline">
                    {group.clientName}
                  </Link>
                  <ul className="mt-1 space-y-1">
                    {group.ideas.map((idea) => (
                      <li key={idea.id} className="truncate pl-3 text-xs text-ink-soft before:mr-1.5 before:content-['·']">
                        {idea.title}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Attention flags" count={attentionFlags.length}>
          {attentionFlags.length === 0 ? (
            <EmptyState title="Nothing flagged" description="Every active client has recent content and a recent consultation." />
          ) : (
            <ul className="divide-y divide-border">
              {attentionFlags.map((flag) => (
                <li key={flag.clientId}>
                  <Link
                    href={`/clients/${flag.clientId}/overview`}
                    className="flex flex-col gap-0.5 rounded-md px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="text-sm text-ink">{flag.clientName}</span>
                    <span className="text-xs text-warning">{flag.reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Opportunities" count={openOpportunities.length}>
          {openOpportunities.length === 0 ? (
            <EmptyState title="Nothing in the pipeline" description="No open authority opportunities right now." />
          ) : (
            <ul className="divide-y divide-border">
              {openOpportunities.map((opp) => {
                const meta = authorityStatusMeta(opp.status as Parameters<typeof authorityStatusMeta>[0]);
                return (
                  <li key={opp.id}>
                    <Link
                      href={`/clients/${opp.clientId}/authority`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{opp.type}{opp.host ? ` — ${opp.host}` : ""}</span>
                        <span className="block truncate text-xs text-ink-faint">{opp.clientName}</span>
                      </span>
                      <StatusPill label={meta.label} color={meta.color} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Client progress" count={clientProgress.length}>
          {clientProgress.length === 0 ? (
            <EmptyState title="No scores yet" description="Add scorecard entries on a client's Metrics tab to see progress here." />
          ) : (
            <ul className="divide-y divide-border">
              {clientProgress.map((row) => (
                <li key={row.clientId}>
                  <Link
                    href={`/clients/${row.clientId}/metrics`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="truncate text-sm text-ink">{row.clientName}</span>
                    <span className="flex-shrink-0 text-xs font-medium text-ink-soft">{row.averageScore.toFixed(1)} / 10</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {isAdmin && (
          <Panel title="Recent activity" count={recentActivity.length}>
            {recentActivity.length === 0 ? (
              <EmptyState title="Nothing recent" description="Activity across clients will show up here." />
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((item) => (
                  <li key={item.id} className="px-2 py-2">
                    <Link href={item.clientId ? `/clients/${item.clientId}/overview` : "#"} className="block hover:bg-surface-muted">
                      <span className="block text-sm text-ink">
                        {item.changedByName} {auditVerb(item.action)} {item.tableName.replace(/_/g, " ")}
                        {item.clientId && <> — <span className="font-medium">{item.clientName}</span></>}
                      </span>
                      <span className="block text-xs text-ink-faint">{formatDateTime(item.changedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
