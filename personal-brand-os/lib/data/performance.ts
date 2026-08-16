import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

export interface PerformanceData {
  clientName: string;
  periodLabel: string;
  from: string;
  to: string;
  platforms: {
    platform: string;
    startFollowers: number;
    endFollowers: number;
    change: number;
    latestEngagement: number | null;
  }[];
  content: { title: string; platform: string | null; status: string; reach: number | null; engagement: number | null }[];
  contentPublished: number;
  avgReach: number | null;
  avgEngagement: number | null;
  authority: { type: string; host: string | null; status: string; url: string | null }[];
  commercial: { description: string; value: number | null; date: string }[];
  commercialTotal: number;
  funnel: { label: string; value: number }[];
  milestones: { title: string; date: string; description: string }[];
  nextActions: { title: string; dueDate: string | null }[];
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/** Everything a Performance Report needs for one client and period, through
 * the caller's RLS view. Content "published in period" is approximated by
 * last-touched date while published/measured — until per-platform outputs
 * carry a real publish date (the planned content-architecture rework). */
export async function buildPerformanceData(
  supabase: Client,
  clientId: string,
  from: string,
  to: string,
  periodLabel: string
): Promise<PerformanceData | null> {
  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const toEnd = `${to}T23:59:59`;
  const [{ data: snapshots }, { data: ideas }, { data: authority }, { data: outcomes }, { data: commSnaps }, { data: milestones }, { data: actions }] =
    await Promise.all([
      supabase
        .from("metric_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .gte("snapshot_date", from)
        .lte("snapshot_date", to)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("content_outputs")
        .select("platform,reach,engagement,status,published_at,content:content_ideas(title)")
        .eq("client_id", clientId)
        .eq("status", "published")
        .gte("published_at", from)
        .lte("published_at", toEnd),
      supabase
        .from("authority_opportunities")
        .select("*")
        .eq("client_id", clientId)
        .in("status", ["booked", "completed", "published"])
        .gte("updated_at", from)
        .lte("updated_at", toEnd),
      supabase
        .from("commercial_outcomes")
        .select("*")
        .eq("client_id", clientId)
        .gte("outcome_date", from)
        .lte("outcome_date", to)
        .order("outcome_date", { ascending: true }),
      supabase
        .from("commercial_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .gte("period_date", from)
        .lte("period_date", to),
      supabase
        .from("milestones")
        .select("*")
        .eq("client_id", clientId)
        .gte("milestone_date", from)
        .lte("milestone_date", to)
        .order("milestone_date", { ascending: true }),
      supabase
        .from("actions")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10),
    ]);

  const byPlatform = new Map<string, NonNullable<typeof snapshots>>();
  for (const snap of snapshots ?? []) {
    const list = byPlatform.get(snap.platform) ?? [];
    list.push(snap);
    byPlatform.set(snap.platform, list);
  }
  const platforms = [...byPlatform.entries()].map(([platform, list]) => {
    const first = list[0]!;
    const last = list[list.length - 1]!;
    return {
      platform,
      startFollowers: first.followers,
      endFollowers: last.followers,
      change: last.followers - first.followers,
      latestEngagement: last.engagement,
    };
  });

  const content = (ideas ?? []).map((i) => ({
    title: i.content?.title ?? "Untitled",
    platform: i.platform,
    status: i.status as string,
    reach: i.reach,
    engagement: i.engagement,
  }));
  const reachValues = content.map((c) => c.reach).filter((v): v is number => v !== null);
  const engagementValues = content.map((c) => c.engagement).filter((v): v is number => v !== null);

  const funnelTotals: [string, number | null][] = [
    ["Leads", sum((commSnaps ?? []).map((s) => s.leads_generated))],
    ["Enquiries", sum((commSnaps ?? []).map((s) => s.enquiries))],
    ["Sales calls", sum((commSnaps ?? []).map((s) => s.sales_calls))],
    ["New customers", sum((commSnaps ?? []).map((s) => s.new_customers))],
    ["Opportunities", sum((commSnaps ?? []).map((s) => s.opportunities_generated))],
  ];

  return {
    clientName: client.name,
    periodLabel,
    from,
    to,
    platforms,
    content,
    contentPublished: content.length,
    avgReach: reachValues.length ? Math.round(reachValues.reduce((a, b) => a + b, 0) / reachValues.length) : null,
    avgEngagement: engagementValues.length
      ? Math.round(engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length)
      : null,
    authority: (authority ?? []).map((a) => ({ type: a.type, host: a.host, status: a.status as string, url: a.published_url })),
    commercial: (outcomes ?? []).map((o) => ({ description: o.description, value: o.value, date: o.outcome_date })),
    commercialTotal: (outcomes ?? []).reduce((total, o) => total + (o.value ?? 0), 0),
    funnel: funnelTotals.filter(([, v]) => v !== null).map(([label, value]) => ({ label, value: value! })),
    milestones: (milestones ?? []).map((m) => ({ title: m.title, date: m.milestone_date, description: m.description })),
    nextActions: (actions ?? []).map((a) => ({ title: a.title, dueDate: a.due_date })),
  };
}
