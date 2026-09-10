import type { SupabaseServerClient } from "@/lib/supabase/server";
import { OUTSTANDING_ASSET_STATUSES } from "@/lib/status";

/**
 * Production — the operational layer between Content and Calendar.
 *
 *   Master Ideas → Production Job / Day → Production Assets → Platform Outputs
 *
 * Everything here READS the content records that already exist. There is no
 * copy of a caption, a pillar, an account or a publish date in any
 * production table — a run sheet is assembled by pointing at Master Ideas,
 * never by duplicating them. That is the whole point of the layer, and the
 * reason it can't drift out of step with Content.
 */

type Client = SupabaseServerClient;

export interface RunSheetOutput {
  id: string;
  platform: string;
  accountName: string | null;
  format: string;
  targetPublishDate: string | null;
}

export interface RunSheetAsset {
  id: string;
  kind: string;
  title: string;
  status: string;
  hook: string;
  brief: string;
  finishCta: string;
  /** Operator-only — never rendered client-facing. */
  productionNotes: string;
  ownerName: string;
  dueDate: string | null;
  /** The platform versions this one asset feeds. */
  feeds: RunSheetOutput[];
}

export interface RunSheetIdea {
  id: string;
  title: string;
  hook: string;
  body: string;
  pillarName: string | null;
  assets: RunSheetAsset[];
  /** Platform versions of this idea that no asset is yet feeding — the gap
   * between what is planned to publish and what anyone has agreed to make. */
  unservedOutputs: RunSheetOutput[];
}

export interface RunSheet {
  job: {
    id: string;
    title: string;
    productionDate: string;
    scheduledAt: string | null;
    status: string;
    location: string;
    notes: string;
  };
  ideas: RunSheetIdea[];
  totals: { ideas: number; assets: number; outstanding: number; outputsServed: number };
}

/**
 * Everything needed to run one production day, built from the Master Ideas
 * attached to it.
 *
 * An idea appears on the sheet because it was scheduled into the day, not
 * because it has assets — a day with ideas and no assets yet is a real and
 * useful state (the shoot is agreed, the shot list isn't). So the join drives
 * the sheet and assets hang off it.
 */
export async function getRunSheet(supabase: Client, clientId: string, jobId: string): Promise<RunSheet | null> {
  const { data: job } = await supabase
    .from("production_jobs")
    .select("id,title,production_date,scheduled_at,status,location,notes")
    .eq("id", jobId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!job) return null;

  const { data: jobIdeas } = await supabase
    .from("production_job_ideas")
    .select("content_id,sort_order")
    .eq("job_id", jobId)
    .order("sort_order");

  const ideaIds = (jobIdeas ?? []).map((row) => row.content_id);
  if (ideaIds.length === 0) {
    return {
      job: {
        id: job.id,
        title: job.title,
        productionDate: job.production_date,
        scheduledAt: job.scheduled_at,
        status: job.status,
        location: job.location,
        notes: job.notes,
      },
      ideas: [],
      totals: { ideas: 0, assets: 0, outstanding: 0, outputsServed: 0 },
    };
  }

  const [{ data: ideas }, { data: assets }, { data: outputs }, { data: pillars }] = await Promise.all([
    supabase.from("content_ideas").select("id,title,hook,body,pillar_id").in("id", ideaIds),
    supabase
      .from("production_assets")
      .select("id,content_id,kind,title,status,hook,brief,finish_cta,production_notes,owner_name,due_date,sort_order")
      .eq("job_id", jobId)
      .order("sort_order"),
    supabase
      .from("content_outputs")
      .select("id,content_id,platform,format,target_publish_date,social:social_strategies(account_name)")
      .in("content_id", ideaIds),
    supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
  ]);

  const assetIds = (assets ?? []).map((a) => a.id);
  const { data: links } = assetIds.length
    ? await supabase.from("production_asset_outputs").select("asset_id,output_id").in("asset_id", assetIds)
    : { data: [] as { asset_id: string; output_id: string }[] };

  const pillarNames = new Map((pillars ?? []).map((p) => [p.id, p.name]));
  const outputById = new Map(
    (outputs ?? []).map((o) => [
      o.id,
      {
        id: o.id,
        contentId: o.content_id,
        platform: o.platform,
        accountName: o.social?.account_name ?? null,
        format: o.format,
        targetPublishDate: o.target_publish_date,
      },
    ])
  );

  const outputsByAsset = new Map<string, RunSheetOutput[]>();
  const servedOutputIds = new Set<string>();
  for (const link of links ?? []) {
    const output = outputById.get(link.output_id);
    if (!output) continue;
    servedOutputIds.add(output.id);
    const list = outputsByAsset.get(link.asset_id) ?? [];
    list.push(output);
    outputsByAsset.set(link.asset_id, list);
  }

  const ideaById = new Map((ideas ?? []).map((i) => [i.id, i]));
  let assetCount = 0;
  let outstanding = 0;

  // Ordered by the job's own sort_order, so the run sheet reads in the order
  // the day is meant to run rather than in whatever order the ideas were
  // created.
  const sheetIdeas: RunSheetIdea[] = ideaIds
    .map((ideaId) => {
      const idea = ideaById.get(ideaId);
      if (!idea) return null;
      const ideaAssets = (assets ?? []).filter((a) => a.content_id === ideaId);
      assetCount += ideaAssets.length;
      outstanding += ideaAssets.filter((a) => (OUTSTANDING_ASSET_STATUSES as string[]).includes(a.status)).length;

      return {
        id: idea.id,
        title: idea.title,
        hook: idea.hook,
        body: idea.body,
        pillarName: idea.pillar_id ? (pillarNames.get(idea.pillar_id) ?? null) : null,
        assets: ideaAssets.map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          title: asset.title,
          status: asset.status,
          hook: asset.hook,
          brief: asset.brief,
          finishCta: asset.finish_cta,
          productionNotes: asset.production_notes,
          ownerName: asset.owner_name,
          dueDate: asset.due_date,
          feeds: outputsByAsset.get(asset.id) ?? [],
        })),
        unservedOutputs: [...outputById.values()]
          .filter((o) => o.contentId === ideaId && !servedOutputIds.has(o.id))
          .map((o) => ({ id: o.id, platform: o.platform, accountName: o.accountName, format: o.format, targetPublishDate: o.targetPublishDate })),
      };
    })
    .filter((row): row is RunSheetIdea => row !== null);

  return {
    job: {
      id: job.id,
      title: job.title,
      productionDate: job.production_date,
      scheduledAt: job.scheduled_at,
      status: job.status,
      location: job.location,
      notes: job.notes,
    },
    ideas: sheetIdeas,
    totals: { ideas: sheetIdeas.length, assets: assetCount, outstanding, outputsServed: servedOutputIds.size },
  };
}

export interface ProductionDaySummary {
  id: string;
  title: string;
  productionDate: string;
  scheduledAt: string | null;
  status: string;
  location: string;
  ideaCount: number;
  assetCount: number;
  outstanding: number;
}

/** The Production Days list — every session for a client, newest first. */
export async function getProductionDays(supabase: Client, clientId: string): Promise<ProductionDaySummary[]> {
  const { data: jobs } = await supabase
    .from("production_jobs")
    .select("id,title,production_date,scheduled_at,status,location")
    .eq("client_id", clientId)
    .order("production_date", { ascending: false });
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const [{ data: jobIdeas }, { data: assets }] = await Promise.all([
    supabase.from("production_job_ideas").select("job_id").in("job_id", jobIds),
    supabase.from("production_assets").select("job_id,status").in("job_id", jobIds),
  ]);

  const ideaCounts = new Map<string, number>();
  for (const row of jobIdeas ?? []) ideaCounts.set(row.job_id, (ideaCounts.get(row.job_id) ?? 0) + 1);

  const assetCounts = new Map<string, { total: number; outstanding: number }>();
  for (const row of assets ?? []) {
    if (!row.job_id) continue;
    const bucket = assetCounts.get(row.job_id) ?? { total: 0, outstanding: 0 };
    bucket.total += 1;
    if ((OUTSTANDING_ASSET_STATUSES as string[]).includes(row.status)) bucket.outstanding += 1;
    assetCounts.set(row.job_id, bucket);
  }

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    productionDate: job.production_date,
    scheduledAt: job.scheduled_at,
    status: job.status,
    location: job.location,
    ideaCount: ideaCounts.get(job.id) ?? 0,
    assetCount: assetCounts.get(job.id)?.total ?? 0,
    outstanding: assetCounts.get(job.id)?.outstanding ?? 0,
  }));
}
