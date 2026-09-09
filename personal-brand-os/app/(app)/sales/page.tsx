import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getPbosSalesOverview, getPbosTiers } from "@/lib/data/pbos-sales";
import { SalesTargetForm } from "@/components/sales/SalesTargetForm";
import { AddLeadButton } from "@/components/sales/AddLeadButton";
import { LeadCard } from "@/components/sales/LeadCard";
import { DealCard } from "@/components/sales/DealCard";
import { EngagementCard } from "@/components/sales/EngagementCard";
import { TierPricing } from "@/components/sales/TierPricing";
import { ProgressRing, HBars } from "@/components/dashboard/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { OPEN_PBOS_STAGES, pbosTierMeta, pbosTierNumber } from "@/lib/status";
import { formatCurrency } from "@/lib/format";
import type { LeadActionRow, TeamOwner, TierOption } from "@/components/sales/shared";

export const metadata = { title: "PBOS Sales" };

/** The operator dashboard: how much business PBOS is generating, across all
 * four tiers, entirely independently of what any client is selling. A
 * client's own sales live on their Sales tab and never appear here. */
export default async function PbosSalesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const tierRows = await getPbosTiers(supabase);

  const [overview, { data: leads }, { data: deals }, { data: engagements }, { data: leadActions }, { data: clients }, { data: team }] =
    await Promise.all([
      getPbosSalesOverview(supabase, tierRows),
      supabase.from("pbos_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("pbos_opportunities").select("*").order("expected_close", { ascending: true, nullsFirst: false }).order("created_at"),
      supabase.from("pbos_engagements").select("*"),
      supabase.from("pbos_lead_actions").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("clients").select("id,name"),
      supabase.from("profiles").select("id,full_name,email,role").in("role", ["admin", "member"]).order("full_name"),
    ]);

  const leadList = leads ?? [];
  const dealList = deals ?? [];
  const engagementList = engagements ?? [];
  const clientNames = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const profileNames = new Map((team ?? []).map((p) => [p.id, p.full_name || p.email]));
  const teamOwners: TeamOwner[] = (team ?? []).map((p) => ({ id: p.id, label: p.full_name || p.email }));

  const tiers: TierOption[] = tierRows.map((tier) => ({
    key: tier.key,
    name: tier.name,
    promise: tier.promise,
    defaultSetupFee: tier.default_setup_fee,
    defaultMonthlyFee: tier.default_monthly_fee,
  }));

  const leadById = new Map(leadList.map((lead) => [lead.id, lead]));
  const actionsByLead = new Map<string, LeadActionRow[]>();
  const actionsByDeal = new Map<string, LeadActionRow[]>();
  for (const action of leadActions ?? []) {
    const row: LeadActionRow = {
      id: action.id,
      title: action.title,
      status: action.status,
      due_date: action.due_date,
      completed_at: action.completed_at,
      ownerLabel: action.owner_user_id ? (profileNames.get(action.owner_user_id) ?? "Team") : (action.owner_name || "Unassigned"),
    };
    const key = action.opportunity_id;
    if (key) actionsByDeal.set(key, [...(actionsByDeal.get(key) ?? []), row]);
    // Lead-level list keeps everything, so a lead card shows the whole picture.
    actionsByLead.set(action.lead_id, [...(actionsByLead.get(action.lead_id) ?? []), row]);
  }

  const openDeals = dealList.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const closedDeals = dealList.filter((d) => d.stage === "won" || d.stage === "lost");
  const openDealCountByLead = new Map<string, number>();
  for (const deal of openDeals) openDealCountByLead.set(deal.lead_id, (openDealCountByLead.get(deal.lead_id) ?? 0) + 1);

  // Leads with nothing live against them: the ones that need a deal creating
  // or closing off, and the easiest thing in a pipeline to lose track of.
  const leadsWithoutDeals = leadList.filter((lead) => lead.status !== "won" && !openDealCountByLead.has(lead.id));

  const liveEngagements = engagementList
    .filter((e) => e.status === "onboarding" || e.status === "active")
    .sort((a, b) => (clientNames.get(a.client_id) ?? "").localeCompare(clientNames.get(b.client_id) ?? ""));
  const pastEngagements = engagementList.filter((e) => e.status === "paused" || e.status === "ended");
  const onboardingCount = liveEngagements.filter((e) => e.status === "onboarding").length;

  const progress =
    overview.monthlyTarget && overview.monthlyTarget > 0
      ? Math.min(100, Math.round((overview.revenueThisMonth / overview.monthlyTarget) * 100))
      : null;

  const kpis = [
    {
      label: "PBOS revenue this month",
      value: formatCurrency(overview.revenueThisMonth),
      detail: [
        `${formatCurrency(overview.mrr)} recurring`,
        overview.setupFeesThisMonth > 0 ? `${formatCurrency(overview.setupFeesThisMonth)} new` : null,
        overview.extrasThisMonth > 0 ? `${formatCurrency(overview.extrasThisMonth)} additional` : null,
      ]
        .filter(Boolean)
        .join(" + "),
    },
    {
      label: "Recurring revenue",
      value: formatCurrency(overview.mrr),
      detail: `${overview.liveClients} live client${overview.liveClients === 1 ? "" : "s"}${onboardingCount > 0 ? `, ${onboardingCount} onboarding` : ""}`,
    },
    {
      label: "New business won",
      value: formatCurrency(overview.newBusinessWon),
      detail:
        overview.dealsWonThisMonth > 0
          ? `${overview.dealsWonThisMonth} deal${overview.dealsWonThisMonth === 1 ? "" : "s"} · ${formatCurrency(overview.newBusinessMrr)} new MRR`
          : "nothing won this month yet",
    },
    {
      label: "Open pipeline",
      value: formatCurrency(overview.pipelineValue),
      detail: `${overview.openOpportunities} deal${overview.openOpportunities === 1 ? "" : "s"} · ${formatCurrency(overview.weightedPipeline)} weighted`,
    },
  ];

  const secondary = [
    {
      label: "Closing in 30 days",
      value: String(overview.closingIn30Days),
      detail: overview.closingIn30DaysValue > 0 ? formatCurrency(overview.closingIn30DaysValue) : "nothing due to close",
      danger: false,
    },
    {
      label: "Open leads",
      value: String(overview.openLeads),
      detail: leadsWithoutDeals.length > 0 ? `${leadsWithoutDeals.length} with no deal yet` : "all have a deal",
      danger: false,
    },
    {
      label: "Conversion rate",
      value: overview.conversionRate !== null ? `${overview.conversionRate}%` : "—",
      detail: overview.conversionRate !== null ? `${overview.wonAllTime} won · ${overview.lostAllTime} lost` : "no closed deals yet",
      danger: false,
    },
    {
      label: "Sales actions overdue",
      value: String(overview.overdueLeadActions),
      detail: overview.overdueLeadActions > 0 ? "chase them" : "nothing overdue",
      danger: overview.overdueLeadActions > 0,
    },
  ];

  const stageBars = OPEN_PBOS_STAGES.map((stage) => {
    const stageDeals = openDeals.filter((d) => d.stage === stage.value);
    const value = stageDeals.reduce((total, d) => total + (d.setup_fee ?? 0) + (d.expected_mrr ?? 0), 0);
    return { label: stage.label, value: stageDeals.length, detail: value > 0 ? formatCurrency(value) : undefined };
  }).filter((bar) => bar.value > 0);

  const tierBars = overview.byTier.map((row) => ({
    label: `${pbosTierNumber(row.tier)} · ${pbosTierMeta(row.tier).label}`,
    value: row.liveClients,
    detail: row.mrr > 0 ? `${formatCurrency(row.mrr)}/mo` : undefined,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">PBOS Sales</h1>
          <p className="mt-1 text-sm font-light text-ink-soft">
            How much business PBOS is generating, across all four tiers. What a client sells lives on their own Sales tab —
            nothing on this page is theirs.
          </p>
        </div>
        <AddLeadButton team={teamOwners} tiers={tiers} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
            <div className="mb-3 h-px w-full" style={{ background: "linear-gradient(90deg, #21c9e0, transparent)" }} />
            <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">{kpi.label}</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-ink">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{kpi.detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {secondary.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-surface px-4 py-3 shadow-md backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">{kpi.label}</p>
            <p className={`mt-1 text-xl font-light tabular-nums ${kpi.danger ? "text-danger" : "text-ink"}`}>{kpi.value}</p>
            <p className={`mt-0.5 text-xs ${kpi.danger ? "text-danger" : "text-ink-faint"}`}>{kpi.detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Monthly target</p>
          {overview.monthlyTarget !== null && overview.monthlyTarget > 0 ? (
            <ProgressRing
              percent={progress ?? 0}
              centre={`${progress ?? 0}%`}
              caption={`${formatCurrency(overview.revenueThisMonth)} of ${formatCurrency(overview.monthlyTarget)} this month`}
            />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">No target set yet.</p>
          )}
          <div className="mt-3 border-t border-border pt-3">
            {isAdmin ? (
              <SalesTargetForm current={overview.monthlyTarget} />
            ) : (
              <p className="text-xs text-ink-faint">Only admins can change the target.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Clients by tier</p>
          {overview.liveClients > 0 ? (
            <HBars items={tierBars} />
          ) : (
            <p className="flex h-40 items-center justify-center text-center text-sm text-ink-faint">
              No live engagements yet — win a deal and the client appears here.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Open deals by stage</p>
          {stageBars.length > 0 ? (
            <HBars items={stageBars} />
          ) : (
            <p className="flex h-40 items-center justify-center text-sm text-ink-faint">No open deals.</p>
          )}
        </div>
      </div>

      {/* Pipeline, in journey order */}
      <h2 className="mb-3 text-lg font-light tracking-tight text-ink">Pipeline</h2>
      <div className="mb-6 space-y-5">
        {OPEN_PBOS_STAGES.map((stage) => {
          const stageDeals = openDeals.filter((d) => d.stage === stage.value);
          if (stageDeals.length === 0) return null;
          const stageValue = stageDeals.reduce((total, d) => total + (d.setup_fee ?? 0) + (d.expected_mrr ?? 0), 0);
          return (
            <section key={stage.value}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {stage.label} · {stageDeals.length}
                {stageValue > 0 && <span className="ml-2 normal-case text-ink-soft">{formatCurrency(stageValue)}</span>}
              </h3>
              <div className="space-y-2">
                {stageDeals.map((deal) => {
                  const lead = leadById.get(deal.lead_id);
                  return (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      leadName={lead?.name ?? "Unknown lead"}
                      leadCompany={lead?.company ?? ""}
                      convertedClientId={lead?.converted_client_id ?? null}
                      actions={actionsByDeal.get(deal.id) ?? []}
                      team={teamOwners}
                      tiers={tiers}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
        {openDeals.length === 0 && (
          <EmptyState
            title="No open deals"
            description="Add a lead, then create the deal against them. Winning it is what creates the client record."
          />
        )}
      </div>

      {/* Leads with nothing live against them */}
      {leadsWithoutDeals.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-light tracking-tight text-ink">
            Leads without a deal <span className="text-sm text-ink-faint">· {leadsWithoutDeals.length}</span>
          </h2>
          <div className="space-y-2">
            {leadsWithoutDeals.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                openDeals={0}
                actions={actionsByLead.get(lead.id) ?? []}
                team={teamOwners}
                tiers={tiers}
              />
            ))}
          </div>
        </section>
      )}

      {/* Won clients and what they're on */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-light tracking-tight text-ink">
          Live engagements <span className="text-sm text-ink-faint">· {formatCurrency(overview.mrr)}/mo</span>
        </h2>
        {liveEngagements.length > 0 ? (
          <div className="space-y-2">
            {liveEngagements.map((engagement) => (
              <EngagementCard
                key={engagement.client_id}
                engagement={engagement}
                clientName={clientNames.get(engagement.client_id) ?? "Unknown client"}
                tiers={tiers}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No live engagements yet" description="Won deals show up here with their tier and terms." />
        )}
      </section>

      {(closedDeals.length > 0 || pastEngagements.length > 0) && (
        <details className="mb-6 rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Closed deals &amp; past engagements · {closedDeals.length + pastEngagements.length} ▾
          </summary>
          <div className="space-y-2 border-t border-border p-4">
            {closedDeals.map((deal) => {
              const lead = leadById.get(deal.lead_id);
              return (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  leadName={lead?.name ?? "Unknown lead"}
                  leadCompany={lead?.company ?? ""}
                  convertedClientId={lead?.converted_client_id ?? null}
                  actions={actionsByDeal.get(deal.id) ?? []}
                  team={teamOwners}
                  tiers={tiers}
                />
              );
            })}
            {pastEngagements.map((engagement) => (
              <EngagementCard
                key={engagement.client_id}
                engagement={engagement}
                clientName={clientNames.get(engagement.client_id) ?? "Unknown client"}
                tiers={tiers}
              />
            ))}
          </div>
        </details>
      )}

      <details className="rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          The four PBOS tiers ▾
        </summary>
        <div className="border-t border-border p-4">
          <TierPricing tiers={tiers} canEdit={isAdmin} />
        </div>
      </details>
    </div>
  );
}
