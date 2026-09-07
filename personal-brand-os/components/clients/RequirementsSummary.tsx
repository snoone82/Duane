import { periodMonthLabel } from "@/lib/monthly-plan-format";
import type { RequirementsSummary as Summary } from "@/lib/requirements-summary";

/**
 * The month, understood at a glance (Duane, after running September end to
 * end): here is what we are producing, here is what we need from you, here
 * is what is waiting. The detailed requirement rows stay underneath — this
 * is the operational overview, they are the working detail.
 *
 * Server component: everything it shows is derived, nothing is interactive.
 */
export function RequirementsSummary({ periodMonth, summary }: { periodMonth: string; summary: Summary }) {
  const { decisions, groups, totals } = summary;
  if (totals.planned === 0 && decisions.length === 0) return null;

  const stats: { label: string; value: number; tone?: string; title?: string }[] = [
    { label: "Planned outputs", value: totals.planned },
    { label: "Production-ready", value: totals.productionReady, tone: "text-success" },
    {
      label: "Waiting on client",
      value: totals.waitingOnClient,
      tone: totals.waitingOnClient > 0 ? "text-amber-600" : undefined,
      title: "Written, but needs something from the client — a photo, a decision, a confirmation — before it can be produced.",
    },
    {
      label: "Blocked",
      value: totals.blocked,
      tone: totals.blocked > 0 ? "text-danger" : undefined,
      title: "Waiting on a real story, view or experience from the client. Counts towards the month's plan, but raises no production work until it clears.",
    },
  ];

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">{periodMonthLabel(periodMonth)} — Production Summary</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        What the month needs, at a glance. The requirement rows below carry the owners, due dates and related content.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md bg-surface-muted px-3 py-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} title={stat.title}>
            <dt className="text-xs text-ink-soft">{stat.label}</dt>
            <dd className={`text-lg font-semibold ${stat.tone ?? "text-ink"}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {decisions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Client decisions</h3>
            <ul className="mt-1.5 space-y-1">
              {decisions.map((decision) => (
                <li key={decision.label} className="text-sm text-ink">
                  {decision.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.group}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{group.heading}</h3>
            <ul className="mt-1.5 space-y-1">
              {group.lines.map((line) => (
                <li key={line.label} className="text-sm text-ink">
                  {line.label}
                  {line.platforms && <span className="text-ink-faint"> · {line.platforms}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="mt-3 text-xs text-ink-soft">
          No production work yet — Platform Outputs are generated in Stage 2, once this month&rsquo;s Master Content is reviewed.
        </p>
      )}
    </section>
  );
}
