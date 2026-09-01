import type { SupabaseServerClient } from "@/lib/supabase/server";
import { cadenceStatus, type CadenceStatus } from "@/lib/platform-strategy";
import type { Database } from "@/lib/database.types";

type SocialRow = Database["public"]["Tables"]["social_strategies"]["Row"];

/**
 * Planned-versus-target cadence for one client, in one place.
 *
 * Duane's point when asking for this on the client dashboard: it must reuse
 * the admin calculation rather than get its own, or the two screens will
 * eventually disagree and neither will be trusted. So this module is the
 * single source — the admin Content tab and the client portal both call it
 * and render the same numbers.
 */

/** The stages a client actually recognises, in pipeline order. */
export const CADENCE_STAGES = [
  { key: "planned", label: "Planned" },
  { key: "in_production", label: "In production" },
  { key: "awaiting_approval", label: "Awaiting approval" },
  { key: "ready_to_schedule", label: "Ready to schedule" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
] as const;

export type CadenceStage = (typeof CADENCE_STAGES)[number]["key"];

export interface CadenceAccount {
  account: SocialRow;
  label: string;
  status: CadenceStatus;
  /** How the month's planned versions break down. */
  stages: Record<CadenceStage, number>;
}

export interface CadenceData {
  accounts: CadenceAccount[];
  monthLabel: string;
  /** Totals across every account, for a headline. "planned" is the overall
   * count for the month; "stages" breaks that same number down. */
  totals: { planned: number; target: number | null; stages: Record<CadenceStage, number> };
}

/**
 * Where a platform version sits, from the client's point of view. The
 * version's own status wins once it's scheduled or published; before that,
 * the master idea's status is what describes it.
 */
function stageFor(outputStatus: string, ideaStatus: string): CadenceStage {
  if (outputStatus === "published") return "published";
  if (outputStatus === "scheduled") return "scheduled";
  switch (ideaStatus) {
    case "published":
      return "published";
    case "scheduled":
    case "ready_to_schedule":
      return "ready_to_schedule";
    case "ready_for_approval":
    case "changes_requested":
      return "awaiting_approval";
    case "in_production":
    case "approved_production":
      return "in_production";
    default:
      return "planned";
  }
}

function emptyStages(): Record<CadenceStage, number> {
  return { planned: 0, in_production: 0, awaiting_approval: 0, ready_to_schedule: 0, scheduled: 0, published: 0 };
}

export function accountLabel(account: Pick<SocialRow, "platform" | "account_name">): string {
  return account.account_name ? `${account.platform} — ${account.account_name}` : account.platform;
}

/**
 * A version counts towards this month when it's scheduled or published in
 * it, or when its master idea is targeted at this month and the version
 * isn't dated yet. Same rule for both audiences, by construction.
 */
export async function getCadenceForClient(
  supabase: SupabaseServerClient,
  clientId: string,
  now: Date = new Date()
): Promise<CadenceData> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [{ data: accounts }, { data: outputs }, { data: ideas }] = await Promise.all([
    supabase.from("social_strategies").select("*").eq("client_id", clientId).order("is_primary", { ascending: false }).order("sort_order"),
    supabase.from("content_outputs").select("id,content_id,social_account_id,status,scheduled_at,published_at").eq("client_id", clientId),
    supabase.from("content_ideas").select("id,status,target_publish_date").eq("client_id", clientId),
  ]);

  const ideaById = new Map((ideas ?? []).map((i) => [i.id, i]));
  const inMonth = (date: string | null | undefined) => Boolean(date) && date! >= monthStart && date! <= monthEnd;

  const byAccount = new Map<string, Record<CadenceStage, number>>();
  for (const output of outputs ?? []) {
    if (!output.social_account_id) continue;
    const idea = ideaById.get(output.content_id);
    const dated = output.scheduled_at?.slice(0, 10) ?? output.published_at?.slice(0, 10) ?? null;
    const counts = dated ? inMonth(dated) : inMonth(idea?.target_publish_date);
    if (!counts) continue;

    const stages = byAccount.get(output.social_account_id) ?? emptyStages();
    stages[stageFor(output.status, idea?.status ?? "idea")] += 1;
    byAccount.set(output.social_account_id, stages);
  }

  const live = (accounts ?? []).filter((a) => a.account_status !== "inactive");
  const totals = { planned: 0, target: null as number | null, stages: emptyStages() };
  let targetSum = 0;
  let anyTarget = false;

  const rows: CadenceAccount[] = live.map((account) => {
    const stages = byAccount.get(account.id) ?? emptyStages();
    const planned = Object.values(stages).reduce((s, n) => s + n, 0);
    const status = cadenceStatus(account, planned);

    totals.planned += planned;
    for (const stage of CADENCE_STAGES) totals.stages[stage.key] += stages[stage.key];
    if (status.target !== null) {
      targetSum += status.target;
      anyTarget = true;
    }

    return { account, label: accountLabel(account), status, stages };
  });

  totals.target = anyTarget ? targetSum : null;

  return {
    accounts: rows,
    monthLabel: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    totals,
  };
}
