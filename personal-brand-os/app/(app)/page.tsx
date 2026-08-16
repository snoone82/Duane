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
import { getCurrentProfile } from "@/lib/current-user";
import { Panel } from "@/components/dashboard/Panel";
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

  const overdueCount = actionsDue.filter((a) => a.isOverdue).length;
  const totalIdeas = contentGroups.reduce((sum, g) => sum + g.ideas.length, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Dashboard</h1>
      <p className="mb-6 text-sm text-ink-soft">
        What needs attention this morning — and where things stand.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-faint">Active clients</p>
          <p className="text-xl font-semibold text-ink">{roster.activeCount}</p>
          <p className="text-xs text-ink-faint">{roster.totalCount} total</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-faint">Monthly retainer total</p>
          <p className="text-xl font-semibold text-ink">{formatCurrency(roster.monthlyRetainerTotal)}</p>
          <p className="text-xs text-ink-faint">{roster.clientsWithRetainer} client{roster.clientsWithRetainer === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-faint">Actions overdue</p>
          <p className="text-xl font-semibold text-ink">{overdueCount}</p>
          <p className="text-xs text-ink-faint">{actionsDue.length} total due</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-faint">Open opportunities</p>
          <p className="text-xl font-semibold text-ink">{openOpportunities.length}</p>
          <p className="text-xs text-ink-faint">across all clients</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Content pipeline · all clients</p>
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
            <div key={stat.label}>
              <p className={`text-lg font-semibold ${stat.danger ? "text-danger" : "text-ink"}`}>{stat.value}</p>
              <p className="text-xs text-ink-faint">{stat.label}</p>
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
