import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

/** A CLIENT's own commercial picture — what their brand is earning THEM.
 * Nothing here feeds the PBOS dashboard: PBOS's own revenue is in
 * lib/data/pbos-sales.ts, and the two must never be added together. */
export interface ClientCommercialProgress {
  monthlyTarget: number | null;
  valueThisMonth: number;
  outcomesThisMonth: number;
  valueLast12Months: number;
  recentOutcomes: { id: string; description: string; value: number | null; outcome_date: string; source: string | null }[];
  latestSnapshot: {
    period_date: string;
    leads_generated: number | null;
    enquiries: number | null;
    sales_calls: number | null;
    opportunities_generated: number | null;
    new_customers: number | null;
    revenue_attributed: number | null;
  } | null;
}

export async function getClientCommercialProgress(supabase: Client, clientId: string): Promise<ClientCommercialProgress> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  const [{ data: strategy }, { data: outcomes }, { data: snapshots }] = await Promise.all([
    supabase.from("sales_strategy").select("monthly_revenue_target").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("commercial_outcomes")
      .select("id,description,value,outcome_date,source")
      .eq("client_id", clientId)
      .gte("outcome_date", yearAgo)
      .order("outcome_date", { ascending: false }),
    supabase
      .from("commercial_snapshots")
      .select("period_date,leads_generated,enquiries,sales_calls,opportunities_generated,new_customers,revenue_attributed")
      .eq("client_id", clientId)
      .order("period_date", { ascending: false })
      .limit(1),
  ]);

  const rows = outcomes ?? [];
  const thisMonth = rows.filter((o) => o.outcome_date >= monthStart && o.outcome_date <= monthEnd);

  return {
    monthlyTarget: strategy?.monthly_revenue_target ?? null,
    valueThisMonth: thisMonth.reduce((sum, o) => sum + (o.value ?? 0), 0),
    outcomesThisMonth: thisMonth.length,
    valueLast12Months: rows.reduce((sum, o) => sum + (o.value ?? 0), 0),
    recentOutcomes: rows.slice(0, 6),
    latestSnapshot: snapshots?.[0] ?? null,
  };
}
