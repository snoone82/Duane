import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { PbosTier } from "@/lib/status";

type Client = SupabaseServerClient;

export type PbosTierRow = Database["public"]["Tables"]["pbos_tiers"]["Row"];
export type PbosLead = Database["public"]["Tables"]["pbos_leads"]["Row"];
export type PbosOpportunity = Database["public"]["Tables"]["pbos_opportunities"]["Row"];
export type PbosEngagement = Database["public"]["Tables"]["pbos_engagements"]["Row"];
export type PbosLeadAction = Database["public"]["Tables"]["pbos_lead_actions"]["Row"];

/** Live engagements — the ones that are actually recurring. 'paused' and
 * 'ended' are deliberately excluded from every revenue figure: a paused
 * client is not billing, and counting them would flatter the number Duane
 * uses to decide whether PBOS is growing. */
const LIVE_ENGAGEMENT_STATUSES = ["onboarding", "active"];

/** What one engagement contributes to MRR. actual_mrr is the truth when
 * someone has confirmed it; expected_mrr is the fallback so a just-won deal
 * still counts. */
export const engagementMrr = (e: Pick<PbosEngagement, "actual_mrr" | "expected_mrr">) =>
  e.actual_mrr ?? e.expected_mrr ?? 0;

export interface TierBreakdown {
  tier: PbosTier;
  /** Open leads whose live opportunity is on this tier. */
  openOpportunities: number;
  pipelineValue: number;
  /** Won clients on this tier right now. */
  liveClients: number;
  mrr: number;
}

export interface PbosSalesOverview {
  monthlyTarget: number | null;

  // "How much business is PBOS generating?" — the question the dashboard exists
  // to answer. Revenue this month = what recurs plus the setup fees invoiced
  // in the month; that is the figure the monthly target is measured against.
  mrr: number;
  setupFeesThisMonth: number;
  /** Project and add-on work billed monthly on top of retainers. */
  extrasThisMonth: number;
  revenueThisMonth: number;

  // Growth, as opposed to run rate.
  newBusinessWon: number;        // setup + first month's recurring, deals won this month
  newBusinessMrr: number;        // the recurring slice of that
  dealsWonThisMonth: number;

  // Forward view.
  pipelineValue: number;         // annualised-free: setup + 12 months is misleading, so this is setup + one month
  weightedPipeline: number;
  openOpportunities: number;
  closingIn30Days: number;
  closingIn30DaysValue: number;
  overdueLeadActions: number;

  // Health.
  conversionRate: number | null; // won / (won + lost), all time
  wonAllTime: number;
  lostAllTime: number;
  openLeads: number;
  liveClients: number;
  byTier: TierBreakdown[];
}

const monthBounds = (now = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
};

/** The whole operator dashboard in one read. Every number here is PBOS's own
 * — nothing in this file touches commercial_outcomes or anything else a
 * client owns. */
export async function getPbosSalesOverview(supabase: Client, tiers: PbosTierRow[]): Promise<PbosSalesOverview> {
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { start: monthStart, end: monthEnd } = monthBounds();

  const [{ data: settings }, { data: opportunities }, { data: engagements }, { data: leads }, { data: leadActions }, { data: clients }] =
    await Promise.all([
      supabase.from("workspace_settings").select("monthly_sales_target").eq("id", true).maybeSingle(),
      supabase.from("pbos_opportunities").select("tier,stage,setup_fee,expected_mrr,probability,expected_close,closed_at"),
      supabase.from("pbos_engagements").select("client_id,tier,status,actual_mrr,expected_mrr,extras_monthly_value,setup_fee,setup_fee_invoiced_on"),
      supabase.from("pbos_leads").select("id,status,tier_interest"),
      supabase.from("pbos_lead_actions").select("id,due_date,status").neq("status", "completed"),
      // Duane: "if a client has an active monthly retainer, that needs to
      // automatically feed into revenue for the current month… I don't want
      // an active retained client appearing as zero revenue simply because
      // there wasn't a new sale that month."
      //
      // The retainer lives on the client record and is what the team
      // actually maintains; pbos_engagements is the commercial contract and
      // is empty for every current client. So recurring revenue is computed
      // per client, taking the engagement's figure when there is one and
      // falling back to the client's own retainer.
      supabase.from("clients").select("id,tier,status,retainer_amount").eq("status", "active"),
    ]);

  const allOpportunities = opportunities ?? [];
  const allEngagements = engagements ?? [];
  const open = allOpportunities.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const won = allOpportunities.filter((o) => o.stage === "won");
  const lost = allOpportunities.filter((o) => o.stage === "lost");
  const wonThisMonth = won.filter((o) => o.closed_at && o.closed_at.slice(0, 10) >= monthStart && o.closed_at.slice(0, 10) <= monthEnd);
  const live = allEngagements.filter((e) => LIVE_ENGAGEMENT_STATUSES.includes(e.status));

  const sum = <T,>(rows: T[], pick: (row: T) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

  const activeClients = clients ?? [];
  const engagementByClient = new Map(live.map((e) => [e.client_id, e]));
  const clientRecurring = (client: { id: string; retainer_amount: number | null }) => {
    const engagement = engagementByClient.get(client.id);
    // A confirmed engagement figure wins — someone has stated it explicitly.
    // Otherwise the standing retainer on the client record is the truth.
    return engagement ? engagementMrr(engagement) : (client.retainer_amount ?? 0);
  };
  const mrr = sum(activeClients, clientRecurring);
  // Project and add-on work billed monthly on top of the retainer.
  const extrasThisMonth = sum(live, (e) => e.extras_monthly_value);
  const setupFeesThisMonth = sum(
    allEngagements.filter((e) => e.setup_fee_invoiced_on && e.setup_fee_invoiced_on >= monthStart && e.setup_fee_invoiced_on <= monthEnd),
    (e) => e.setup_fee,
  );

  // A deal's day-one value: the one-off setup plus the first month of
  // recurring. Deliberately not annualised — a 12-month multiple would make
  // one Partner deal swamp a monthly target and stop the number meaning
  // anything month to month.
  const dealValue = (o: { setup_fee: number | null; expected_mrr: number | null }) => (o.setup_fee ?? 0) + (o.expected_mrr ?? 0);

  const closingSoon = open.filter((o) => o.expected_close && o.expected_close >= today && o.expected_close <= in30Days);

  const byTier: TierBreakdown[] = tiers.map((tier) => {
    const tierOpen = open.filter((o) => o.tier === tier.key);
    const tierClients = activeClients.filter((c) => c.tier === tier.key);
    return {
      tier: tier.key as PbosTier,
      openOpportunities: tierOpen.length,
      pipelineValue: sum(tierOpen, dealValue),
      liveClients: tierClients.length,
      mrr: sum(tierClients, clientRecurring),
    };
  });

  const closedCount = won.length + lost.length;

  return {
    monthlyTarget: settings?.monthly_sales_target ?? null,

    mrr,
    setupFeesThisMonth,
    extrasThisMonth,
    revenueThisMonth: mrr + setupFeesThisMonth + extrasThisMonth,

    newBusinessWon: sum(wonThisMonth, dealValue),
    newBusinessMrr: sum(wonThisMonth, (o) => o.expected_mrr),
    dealsWonThisMonth: wonThisMonth.length,

    pipelineValue: sum(open, dealValue),
    weightedPipeline: Math.round(open.reduce((total, o) => total + (dealValue(o) * o.probability) / 100, 0)),
    openOpportunities: open.length,
    closingIn30Days: closingSoon.length,
    closingIn30DaysValue: sum(closingSoon, dealValue),
    overdueLeadActions: (leadActions ?? []).filter((a) => a.due_date && a.due_date < today).length,

    conversionRate: closedCount > 0 ? Math.round((won.length / closedCount) * 100) : null,
    wonAllTime: won.length,
    lostAllTime: lost.length,
    openLeads: (leads ?? []).filter((l) => l.status === "open").length,
    liveClients: activeClients.length,
    byTier,
  };
}

export async function getPbosTiers(supabase: Client): Promise<PbosTierRow[]> {
  const { data } = await supabase.from("pbos_tiers").select("*").order("rank");
  return data ?? [];
}
