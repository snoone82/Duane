import type { Database } from "@/lib/database.types";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { SCORECARD_CATEGORIES } from "@/lib/scorecard";

type Client = SupabaseServerClient;
type Snapshot = Database["public"]["Tables"]["metric_snapshots"]["Row"];
type ScorecardEntry = Database["public"]["Tables"]["scorecard_entries"]["Row"];

export interface PlatformMetric {
  platform: string;
  baseline: number | null;
  current: number | null;
  currentDate: string | null;
  target: number | null;
  targetDate: string | null;
  /** The full most-recent snapshot, for the detail breakdown below the
   * summary table — brief §15 wants ~10 metrics per platform, not just
   * followers. */
  latestSnapshot: Snapshot | null;
}

export async function getPlatformMetrics(supabase: Client, clientId: string): Promise<PlatformMetric[]> {
  const [{ data: snapshots }, { data: targets }] = await Promise.all([
    supabase.from("metric_snapshots").select("*").eq("client_id", clientId).order("snapshot_date", { ascending: true }),
    supabase.from("metric_targets").select("*").eq("client_id", clientId),
  ]);

  const platforms = new Set<string>();
  const byPlatform = new Map<string, Snapshot[]>();
  for (const snap of snapshots ?? []) {
    platforms.add(snap.platform);
    const list = byPlatform.get(snap.platform) ?? [];
    list.push(snap);
    byPlatform.set(snap.platform, list);
  }
  const targetsByPlatform = new Map((targets ?? []).map((t) => [t.platform, t]));
  for (const target of targets ?? []) platforms.add(target.platform);

  return Array.from(platforms)
    .sort()
    .map((platform) => {
      const rows = byPlatform.get(platform) ?? [];
      const target = targetsByPlatform.get(platform);
      const first = rows[0];
      const last = rows[rows.length - 1];
      return {
        platform,
        baseline: target?.baseline_value ?? first?.followers ?? null,
        current: last?.followers ?? null,
        currentDate: last?.snapshot_date ?? null,
        target: target?.target_value ?? null,
        targetDate: target?.target_date ?? null,
        latestSnapshot: last ?? null,
      };
    });
}

export interface ScorecardRow {
  category: string;
  latest: number | null;
  latestDate: string | null;
  previous: number | null;
}

export async function getScorecard(supabase: Client, clientId: string): Promise<ScorecardRow[]> {
  const { data: entries } = await supabase
    .from("scorecard_entries")
    .select("*")
    .eq("client_id", clientId)
    .order("scored_at", { ascending: false });

  const byCategory = new Map<string, ScorecardEntry[]>();
  for (const entry of entries ?? []) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  return SCORECARD_CATEGORIES.map((category) => {
    const rows = byCategory.get(category) ?? [];
    return {
      category,
      latest: rows[0]?.score ?? null,
      latestDate: rows[0]?.scored_at ?? null,
      previous: rows[1]?.score ?? null,
    };
  });
}

export interface ContentMetrics {
  postsPublished: number;
  averageReach: number | null;
  averageEngagement: number | null;
  topContent: { id: string; title: string; reach: number | null }[];
  topPillar: { name: string; averageReach: number } | null;
}

/** §15 Content Metrics — derived from content_ideas rather than a separate
 * entry form: "published"/"measured" pieces with a reach/engagement number
 * attached are what "highest-performing content" and "most successful
 * pillar" rank against. */
export async function getContentMetrics(supabase: Client, clientId: string): Promise<ContentMetrics> {
  const { data: ideas } = await supabase
    .from("content_ideas")
    .select("id,title,status,reach,engagement,pillar_id")
    .eq("client_id", clientId)
    .in("status", ["published", "measured"]);

  const rows = ideas ?? [];
  const withReach = rows.filter((r) => r.reach !== null);
  const withEngagement = rows.filter((r) => r.engagement !== null);

  const averageReach = withReach.length
    ? withReach.reduce((sum, r) => sum + (r.reach ?? 0), 0) / withReach.length
    : null;
  const averageEngagement = withEngagement.length
    ? withEngagement.reduce((sum, r) => sum + (r.engagement ?? 0), 0) / withEngagement.length
    : null;

  const topContent = [...withReach]
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 5)
    .map((r) => ({ id: r.id, title: r.title, reach: r.reach }));

  let topPillar: ContentMetrics["topPillar"] = null;
  const pillarIds = [...new Set(withReach.map((r) => r.pillar_id).filter((id): id is string => id !== null))];
  if (pillarIds.length > 0) {
    const { data: pillars } = await supabase.from("brand_pillars").select("id,name").in("id", pillarIds);
    const pillarNames = new Map((pillars ?? []).map((p) => [p.id, p.name]));
    const byPillar = new Map<string, number[]>();
    for (const r of withReach) {
      if (!r.pillar_id) continue;
      const list = byPillar.get(r.pillar_id) ?? [];
      list.push(r.reach ?? 0);
      byPillar.set(r.pillar_id, list);
    }
    let best: { id: string; avg: number } | null = null;
    for (const [pillarId, reaches] of byPillar) {
      const avg = reaches.reduce((sum, v) => sum + v, 0) / reaches.length;
      if (!best || avg > best.avg) best = { id: pillarId, avg };
    }
    if (best) {
      topPillar = { name: pillarNames.get(best.id) ?? "Unknown pillar", averageReach: best.avg };
    }
  }

  return {
    postsPublished: rows.length,
    averageReach,
    averageEngagement,
    topContent,
    topPillar,
  };
}
