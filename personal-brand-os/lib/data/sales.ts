import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

export interface SalesOverview {
  monthlyTarget: number | null;
  /** Sum of commercial outcome values dated this calendar month, across
   * every client the signed-in user can see. */
  actualThisMonth: number;
  outcomesThisMonth: number;
}

export async function getSalesOverview(supabase: Client): Promise<SalesOverview> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;

  const [{ data: settings }, { data: outcomes }] = await Promise.all([
    supabase.from("workspace_settings").select("monthly_sales_target").eq("id", true).maybeSingle(),
    supabase
      .from("commercial_outcomes")
      .select("value")
      .gte("outcome_date", monthStart)
      .lte("outcome_date", monthEnd),
  ]);

  const rows = outcomes ?? [];
  return {
    monthlyTarget: settings?.monthly_sales_target ?? null,
    actualThisMonth: rows.reduce((sum, o) => sum + (o.value ?? 0), 0),
    outcomesThisMonth: rows.length,
  };
}
