"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { SCORECARD_CATEGORIES } from "@/lib/scorecard";

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? Number(raw) : null;
}

/** A second snapshot for the same client/platform/day upserts rather than
 * erroring, per the brief's data note on metric_snapshots' unique constraint.
 * `followers` is the one required number (it's what baseline→current→target
 * tracks); everything else in brief §15's Social Metrics list is optional —
 * fill in whatever you actually have for that platform that day. */
export async function addMetricSnapshot(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const platform = String(formData.get("platform") ?? "").trim();
  const snapshotDate = String(formData.get("snapshot_date") ?? "").trim();
  const followers = num(formData, "followers");

  if (!platform) return { ok: false, message: "Platform is required." };
  if (!snapshotDate) return { ok: false, message: "Date is required." };
  if (followers === null || !Number.isFinite(followers)) return { ok: false, message: "Followers must be a number." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("metric_snapshots").upsert(
      {
        client_id: clientId,
        platform,
        snapshot_date: snapshotDate,
        followers,
        follower_growth: num(formData, "follower_growth"),
        impressions: num(formData, "impressions"),
        reach: num(formData, "reach"),
        engagement: num(formData, "engagement"),
        profile_visits: num(formData, "profile_visits"),
        video_views: num(formData, "video_views"),
        comments: num(formData, "comments"),
        shares: num(formData, "shares"),
        saves: num(formData, "saves"),
      },
      { onConflict: "client_id,platform,snapshot_date" }
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/metrics`);
    return undefined;
  });
}

export async function setMetricTarget(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const platform = String(formData.get("platform") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim() || null;
  if (!platform) return { ok: false, message: "Platform is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("metric_targets").upsert(
      {
        client_id: clientId,
        platform,
        baseline_value: num(formData, "baseline_value"),
        target_value: num(formData, "target_value"),
        target_date: targetDate,
      },
      { onConflict: "client_id,platform" }
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/metrics`);
    return undefined;
  });
}

export async function addScorecardEntry(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const score = Number(formData.get("score"));
  const scoredAt = String(formData.get("scored_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!SCORECARD_CATEGORIES.includes(category as (typeof SCORECARD_CATEGORIES)[number])) {
    return { ok: false, message: "Unknown category." };
  }
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    return { ok: false, message: "Score must be between 0 and 10." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("scorecard_entries").insert({
      client_id: clientId,
      category,
      score,
      scored_at: scoredAt || undefined,
      notes,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/metrics`);
    return undefined;
  });
}

export async function addCommercialOutcome(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const outcomeDate = String(formData.get("outcome_date") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim() || null;
  if (!description) return { ok: false, message: "Description is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("commercial_outcomes").insert({
      client_id: clientId,
      description,
      value: num(formData, "value"),
      outcome_date: outcomeDate || undefined,
      source,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/metrics`);
    return undefined;
  });
}

/** §15 Commercial Metrics — periodic structured counts, upserting on
 * (client_id, period_date) the same way metric_snapshots does. Distinct
 * from commercial_outcomes, which stays a narrative log of individual wins. */
export async function addCommercialSnapshot(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const periodDate = String(formData.get("period_date") ?? "").trim();
  if (!periodDate) return { ok: false, message: "Date is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("commercial_snapshots").upsert(
      {
        client_id: clientId,
        period_date: periodDate,
        leads_generated: num(formData, "leads_generated"),
        enquiries: num(formData, "enquiries"),
        sales_calls: num(formData, "sales_calls"),
        new_customers: num(formData, "new_customers"),
        revenue_attributed: num(formData, "revenue_attributed"),
        opportunities_generated: num(formData, "opportunities_generated"),
      },
      { onConflict: "client_id,period_date" }
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/metrics`);
    return undefined;
  });
}
