import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getSalesOverview } from "@/lib/data/sales";
import { SalesTargetForm } from "@/components/sales/SalesTargetForm";
import { AddOpportunityButton } from "@/components/sales/AddOpportunityButton";
import { OpportunityCard, type OpportunityAction } from "@/components/sales/OpportunityCard";
import { ProgressRing, HBars } from "@/components/dashboard/Charts";
import { SALES_STAGES } from "@/lib/status";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Sales" };

/** Duane batch 8: the main Sales area is live execution — prospects,
 * opportunities, pipeline, forecast, won/lost — while each client's Sales
 * tab stays their sales *strategy*. */
export default async function SalesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const today = new Date().toISOString().slice(0, 10);

  const [overview, { data: clients }, { data: opportunities }, { data: salesActions }, { data: team }] = await Promise.all([
    getSalesOverview(supabase),
    supabase.from("clients").select("id,name,status,retainer_amount").order("name"),
    supabase.from("sales_opportunities").select("*").order("expected_close", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("actions").select("id,title,status,due_date,owner_user_id,owner_name,completed_at,sales_opportunity_id").not("sales_opportunity_id", "is", null),
    supabase.from("profiles").select("id,full_name,email,role").in("role", ["admin", "member"]).order("full_name"),
  ]);

  const clientList = clients ?? [];
  const clientById = new Map(clientList.map((c) => [c.id, c]));
  const profileNames = new Map((team ?? []).map((p) => [p.id, p.full_name || p.email]));
  const teamOwners = (team ?? []).map((p) => ({ id: p.id, label: p.full_name || p.email }));

  const actionsByOpportunity = new Map<string, OpportunityAction[]>();
  for (const action of salesActions ?? []) {
    const key = action.sales_opportunity_id as string;
    const list = actionsByOpportunity.get(key) ?? [];
    list.push({
      id: action.id,
      title: action.title,
      status: action.status,
      due_date: action.due_date,
      completed_at: action.completed_at,
      ownerLabel: action.owner_user_id ? (profileNames.get(action.owner_user_id) ?? "Team") : (action.owner_name ?? "Unassigned"),
    });
    actionsByOpportunity.set(key, list);
  }

  const all = opportunities ?? [];
  const open = all.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const won = all.filter((o) => o.stage === "won");
  const lost = all.filter((o) => o.stage === "lost");

  const pipelineValue = open.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0);
  const forecastValue = open.reduce((sum, o) => sum + ((o.estimated_value ?? 0) * o.probability) / 100, 0);
  const overdueSalesActions = (salesActions ?? []).filter((a) => a.status !== "completed" && a.due_date && a.due_date < today).length;
  const closingSoon = open.filter((o) => o.expected_close && o.expected_close <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).length;
  const conversion = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : null;

  const progress =
    overview.monthlyTarget && overview.monthlyTarget > 0
      ? Math.min(100, Math.round((overview.actualThisMonth / overview.monthlyTarget) * 100))
      : null;

  const stageBars = SALES_STAGES.filter((s) => s.value !== "won" && s.value !== "lost")
    .map((stage) => ({
      label: stage.label,
      value: open.filter((o) => o.stage === stage.value).length,
      detail: (() => {
        const total = open.filter((o) => o.stage === stage.value).reduce((sum, o) => sum + (o.estimated_value ?? 0), 0);
        return total > 0 ? formatCurrency(total) : undefined;
      })(),
    }))
    .filter((bar) => bar.value > 0);

  const kpis = [
    { label: "Open pipeline", value: formatCurrency(pipelineValue), detail: `${open.length} open opportunit${open.length === 1 ? "y" : "ies"}` },
    { label: "Forecast (weighted)", value: formatCurrency(Math.round(forecastValue)), detail: "value × probability" },
    { label: "Recorded this month", value: formatCurrency(overview.actualThisMonth), detail: `${overview.outcomesThisMonth} outcome${overview.outcomesThisMonth === 1 ? "" : "s"}` },
    {
      label: "Closing in 14 days",
      value: String(closingSoon),
      detail: overdueSalesActions > 0 ? `${overdueSalesActions} sales action${overdueSalesActions === 1 ? "" : "s"} overdue` : "no overdue sales actions",
      danger: overdueSalesActions > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">Sales</h1>
          <p className="mt-1 text-sm font-light text-ink-soft">
            Live pipeline and forecast. Each client&rsquo;s own sales <em>strategy</em> lives on their Sales tab.
          </p>
        </div>
        <AddOpportunityButton clients={clientList} team={teamOwners} />
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
            <div className="mb-3 h-px w-full" style={{ background: "linear-gradient(90deg, #21c9e0, transparent)" }} />
            <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-light tabular-nums ${kpi.danger ? "text-danger" : "text-ink"}`}>{kpi.value}</p>
            <p className={`mt-0.5 text-xs ${kpi.danger ? "text-danger" : "text-ink-faint"}`}>{kpi.detail}</p>
          </div>
        ))}
      </div>

      {/* Target + stage distribution */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Monthly target</p>
          {overview.monthlyTarget !== null && overview.monthlyTarget > 0 ? (
            <ProgressRing
              percent={progress ?? 0}
              centre={`${progress ?? 0}%`}
              caption={`${formatCurrency(overview.actualThisMonth)} of ${formatCurrency(overview.monthlyTarget)} recorded`}
            />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">No target set yet.</p>
          )}
          <div className="mt-3 border-t border-border pt-3">
            {isAdmin ? <SalesTargetForm current={overview.monthlyTarget} /> : <p className="text-xs text-ink-faint">Only admins can change the target.</p>}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Open opportunities by stage</p>
          {stageBars.length > 0 ? (
            <HBars items={stageBars} />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">No open opportunities — add the first one.</p>
          )}
          {conversion !== null && (
            <p className="mt-3 border-t border-border pt-2 text-xs text-ink-faint">
              Conversion: {conversion}% ({won.length} won · {lost.length} lost)
            </p>
          )}
        </div>
      </div>

      {/* Pipeline — journey order */}
      <div className="mb-6 space-y-5">
        {SALES_STAGES.filter((s) => s.value !== "won" && s.value !== "lost").map((stage) => {
          const stageOpps = open.filter((o) => o.stage === stage.value);
          if (stageOpps.length === 0) return null;
          const stageValue = stageOpps.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0);
          return (
            <section key={stage.value}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {stage.label} · {stageOpps.length}
                {stageValue > 0 && <span className="ml-2 normal-case text-ink-soft">{formatCurrency(stageValue)}</span>}
              </h2>
              <div className="space-y-2">
                {stageOpps.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    clientName={clientById.get(opportunity.client_id)?.name ?? "Unknown"}
                    clientStatus={clientById.get(opportunity.client_id)?.status ?? ""}
                    actions={actionsByOpportunity.get(opportunity.id) ?? []}
                    team={teamOwners}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {open.length === 0 && (
          <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-ink-soft">
            The pipeline is empty. Add a prospect on the Clients page (status: Prospect), then create their first opportunity here.
          </p>
        )}
      </div>

      {/* Won / lost history */}
      {(won.length > 0 || lost.length > 0) && (
        <details className="mb-6 rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Won &amp; lost · {won.length + lost.length} ▾
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {[...won, ...lost].map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                clientName={clientById.get(opportunity.client_id)?.name ?? "Unknown"}
                clientStatus={clientById.get(opportunity.client_id)?.status ?? ""}
                actions={actionsByOpportunity.get(opportunity.id) ?? []}
                team={teamOwners}
              />
            ))}
          </div>
        </details>
      )}

      {/* Strategy links (the old view, demoted but kept) */}
      <details className="rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Sales strategy by client ▾
        </summary>
        <div className="space-y-1.5 border-t border-border p-4">
          {clientList.map((client) => (
            <div key={client.id} className="flex items-center justify-between gap-3">
              <Link href={`/clients/${client.id}/sales`} className="text-sm text-accent underline-offset-2 hover:underline">
                {client.name}
              </Link>
              <span className="text-xs text-ink-faint">
                {client.retainer_amount ? `${formatCurrency(client.retainer_amount)}/month` : client.status}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
