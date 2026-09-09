/**
 * What the month has actually achieved — the "is it working?" half of the
 * client dashboard (Duane, testing as Jonny).
 *
 * The join that makes this worth having is already in the data: every
 * Platform Output belongs to a Master Content idea, and that idea carries a
 * pillar. So PBOS can say which *theme* performed, not just which post —
 * which is the thing Ayrshare cannot know on its own.
 *
 *   output → published through Ayrshare → analytics pulled onto the output
 *   output → its master idea → its pillar → performance by pillar
 *
 * Website sign-ups are deliberately NOT from Ayrshare. A link click is not a
 * completed form, so conversions come from commercial_outcomes, recorded in
 * PBOS from whatever handles the client's forms.
 *
 * Everything here distinguishes "nothing published" from "published and
 * measured zero" — a dashboard that shows 0 impressions as though it were a
 * result is worse than one that says the numbers haven't landed yet.
 */

export interface ResultsOutput {
  status: string;
  published_at: string | null;
  analytics_at: string | null;
  reach: number | null;
  views: number | null;
  engagement: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  content_id: string;
  platform: string;
}

export interface ResultsIdea {
  id: string;
  pillar_id: string | null;
}

export interface ResultsOutcome {
  value: number | null;
  outcome_date: string;
  description: string;
}

export interface ClientResults {
  publishedThisMonth: number;
  /** Impressions where the network reports them, views otherwise. */
  reach: number;
  views: number;
  interactions: number;
  /** Interactions ÷ reach, as a percentage — null when reach is unknown. */
  engagementRate: number | null;
  outcomesThisMonth: number;
  outcomeValue: number;
  topPillar: { name: string; interactions: number; posts: number } | null;
  /** How many published posts carry analytics — the honest caveat under
   * every number above. */
  measured: number;
  awaitingMeasurement: number;
  lastMeasuredAt: string | null;
}

const monthBounds = (now: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { start, end: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(last)}` };
};

export function buildClientResults(
  outputs: ResultsOutput[],
  ideas: ResultsIdea[],
  pillarNames: Map<string, string>,
  outcomes: ResultsOutcome[],
  now = new Date()
): ClientResults {
  const { start, end } = monthBounds(now);
  const inMonth = (iso: string | null) => Boolean(iso && iso.slice(0, 10) >= start && iso.slice(0, 10) <= end);

  const publishedThisMonth = outputs.filter((o) => o.status === "published" && inMonth(o.published_at));
  // Measurement is reported across everything published, not just this
  // month: a post from three weeks ago is still accruing numbers.
  const published = outputs.filter((o) => o.status === "published");
  const measured = published.filter((o) => o.analytics_at !== null);

  const sum = (rows: ResultsOutput[], pick: (o: ResultsOutput) => number | null) =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

  const interactionsOf = (o: ResultsOutput) =>
    o.engagement ?? (o.likes ?? 0) + (o.comments ?? 0) + (o.shares ?? 0);

  const reach = sum(measured, (o) => o.reach);
  const views = sum(measured, (o) => o.views);
  const interactions = measured.reduce((total, o) => total + interactionsOf(o), 0);
  // Reach is the honest denominator; fall back to views only when a network
  // reports one and not the other.
  const denominator = reach || views;
  const engagementRate = denominator > 0 ? Math.round((interactions / denominator) * 1000) / 10 : null;

  // --- performance by pillar ---
  const pillarByIdea = new Map(ideas.map((i) => [i.id, i.pillar_id]));
  const byPillar = new Map<string, { interactions: number; posts: number }>();
  for (const output of measured) {
    const pillarId = pillarByIdea.get(output.content_id);
    if (!pillarId) continue;
    const bucket = byPillar.get(pillarId) ?? { interactions: 0, posts: 0 };
    bucket.interactions += interactionsOf(output);
    bucket.posts += 1;
    byPillar.set(pillarId, bucket);
  }
  let topPillar: ClientResults["topPillar"] = null;
  for (const [pillarId, bucket] of byPillar) {
    if (bucket.interactions <= 0) continue;
    if (!topPillar || bucket.interactions > topPillar.interactions) {
      topPillar = { name: pillarNames.get(pillarId) ?? "Unknown pillar", interactions: bucket.interactions, posts: bucket.posts };
    }
  }

  const monthOutcomes = outcomes.filter((o) => o.outcome_date >= start && o.outcome_date <= end);

  return {
    publishedThisMonth: publishedThisMonth.length,
    reach,
    views,
    interactions,
    engagementRate,
    outcomesThisMonth: monthOutcomes.length,
    outcomeValue: monthOutcomes.reduce((total, o) => total + (o.value ?? 0), 0),
    topPillar,
    measured: measured.length,
    awaitingMeasurement: published.length - measured.length,
    lastMeasuredAt:
      measured.map((o) => o.analytics_at).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null,
  };
}
