"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { PRODUCTION_ASSET_KIND, PRODUCTION_ASSET_STATUS, PRODUCTION_JOB_STATUS } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";
import { suggestAssets } from "@/lib/production-suggest";
import type { Database } from "@/lib/database.types";

type JobUpdate = Database["public"]["Tables"]["production_jobs"]["Update"];
type AssetUpdate = Database["public"]["Tables"]["production_assets"]["Update"];

/**
 * Production actions.
 *
 * Every write here is production-only. Nothing in this file writes a
 * caption, a pillar, an account or a publish date — those stay on the
 * content records Production points at.
 */

function revalidateProduction(clientId: string) {
  revalidatePath(`/clients/${clientId}/production`, "layout");
  revalidatePath(`/clients/${clientId}/calendar`);
  revalidatePath(`/clients/${clientId}/content`);
}

export async function createProductionJob(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const productionDate = String(formData.get("production_date") ?? "").trim();
  if (!title) return { ok: false, message: "Give the day a name — usually the client and what's being made." };
  if (!productionDate) return { ok: false, message: "A production date is required." };

  const time = String(formData.get("start_time") ?? "").trim();

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("production_jobs").insert({
      client_id: clientId,
      title,
      production_date: productionDate,
      // The hour is optional: a filming day is usually agreed before the
      // time is settled, and the run sheet only needs the date.
      scheduled_at: time ? new Date(`${productionDate}T${time}`).toISOString() : null,
      location: String(formData.get("location") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      default_owner_name: String(formData.get("default_owner_name") ?? "").trim(),
      default_approver_name: String(formData.get("default_approver_name") ?? "").trim(),
      created_by: user?.id ?? null,
    });
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

export async function updateProductionJobField(
  clientId: string,
  jobId: string,
  field: "title" | "production_date" | "status" | "location" | "notes" | "default_owner_name" | "default_approver_name",
  value: string
): Promise<ActionResult> {
  if (field === "status" && !PRODUCTION_JOB_STATUS.some((s) => s.value === value)) {
    return { ok: false, message: "That isn't a valid production status." };
  }
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("production_jobs")
      .update({ ...fieldPatch<JobUpdate>(field, field === "production_date" ? value || null : value), updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

export async function deleteProductionJob(clientId: string, jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    // Assets survive — job_id is ON DELETE SET NULL. Cancelling a shoot
    // shouldn't destroy the record of what was going to be made.
    const { error } = await supabase.from("production_jobs").delete().eq("id", jobId).eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

/**
 * Schedule approved Master Ideas into a production day — and work out what
 * obviously needs making while we're there.
 *
 * Duane's complaint was ten ideas meaning ten more forms. Attaching now
 * reads each idea's existing platform versions, proposes the assets that
 * serve them (one talking head for every video-shaped version, and so on),
 * creates those and wires them to the versions they feed. Owner and approver
 * come from the day's defaults.
 *
 * Everything created is editable afterwards and nothing is invented: the
 * proposal is derived entirely from platform versions that already exist. An
 * idea whose versions are all text gets no asset, which is correct.
 */
export async function addIdeasToJob(
  clientId: string,
  jobId: string,
  contentIds: string[],
  options: { suggestAssets?: boolean } = {}
): Promise<ActionResult<{ attached: number; assetsCreated: number }>> {
  return runAction(async () => {
    if (contentIds.length === 0) throw new UserFacingError("Pick at least one piece of content to produce.");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: job } = await supabase
      .from("production_jobs")
      .select("id,default_owner_name")
      .eq("id", jobId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!job) throw new UserFacingError("That production day doesn't exist for this client.");

    const { data: existing } = await supabase.from("production_job_ideas").select("content_id").eq("job_id", jobId);
    const already = new Set((existing ?? []).map((r) => r.content_id));
    const fresh = contentIds.filter((id) => !already.has(id));
    if (fresh.length === 0) return { attached: 0, assetsCreated: 0 };

    const { error } = await supabase
      .from("production_job_ideas")
      .insert(fresh.map((id, index) => ({ job_id: jobId, content_id: id, sort_order: already.size + index })));
    if (error) throw new UserFacingError(error.message);

    let assetsCreated = 0;
    if (options.suggestAssets !== false) {
      const [{ data: ideas }, { data: outputs }, { data: currentAssets }] = await Promise.all([
        supabase.from("content_ideas").select("id,title,hook,body,cta").in("id", fresh),
        supabase.from("content_outputs").select("id,content_id,format").in("content_id", fresh),
        // Never propose over the top of work someone has already set up.
        supabase.from("production_assets").select("content_id").in("content_id", fresh),
      ]);
      const alreadyHasAssets = new Set((currentAssets ?? []).map((a) => a.content_id));

      for (const idea of ideas ?? []) {
        if (alreadyHasAssets.has(idea.id)) continue;
        const ideaOutputs = (outputs ?? []).filter((o) => o.content_id === idea.id).map((o) => ({ id: o.id, format: o.format }));
        for (const [index, suggestion] of suggestAssets(ideaOutputs).entries()) {
          const { data: asset, error: assetError } = await supabase
            .from("production_assets")
            .insert({
              client_id: clientId,
              content_id: idea.id,
              job_id: jobId,
              kind: suggestion.kind,
              title: suggestion.title,
              // Straight from the Master Idea — the whole point is not
              // retyping what PBOS already holds.
              hook: idea.hook,
              brief: idea.body,
              finish_cta: idea.cta,
              owner_name: job.default_owner_name,
              sort_order: index,
              created_by: user?.id ?? null,
            })
            .select("id")
            .single();
          if (assetError) throw new UserFacingError(assetError.message);

          if (suggestion.outputIds.length > 0) {
            const { error: linkError } = await supabase
              .from("production_asset_outputs")
              .insert(suggestion.outputIds.map((outputId) => ({ asset_id: asset.id, output_id: outputId })));
            if (linkError) throw new UserFacingError(linkError.message);
          }
          assetsCreated += 1;
        }
      }
    }

    revalidateProduction(clientId);
    return { attached: fresh.length, assetsCreated };
  });
}

export async function removeIdeaFromJob(clientId: string, jobId: string, contentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: job } = await supabase.from("production_jobs").select("id").eq("id", jobId).eq("client_id", clientId).maybeSingle();
    if (!job) throw new UserFacingError("That production day doesn't exist for this client.");
    const { error } = await supabase.from("production_job_ideas").delete().eq("job_id", jobId).eq("content_id", contentId);
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

export async function createProductionAsset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const contentId = String(formData.get("content_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "video");
  if (!contentId) return { ok: false, message: "An asset has to belong to a piece of Master Content." };
  if (!title) return { ok: false, message: "Give the asset a name." };
  if (!PRODUCTION_ASSET_KIND.some((k) => k.value === kind)) return { ok: false, message: "That isn't a valid asset type." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const jobId = String(formData.get("job_id") ?? "").trim() || null;
    // Inherit the day's owner unless this asset names its own — the whole
    // point of setting it once on the production day.
    let ownerName = String(formData.get("owner_name") ?? "").trim();
    if (!ownerName && jobId) {
      const { data: job } = await supabase.from("production_jobs").select("default_owner_name").eq("id", jobId).maybeSingle();
      ownerName = job?.default_owner_name ?? "";
    }
    const { error } = await supabase.from("production_assets").insert({
      client_id: clientId,
      content_id: contentId,
      job_id: jobId,
      kind,
      title,
      hook: String(formData.get("hook") ?? "").trim(),
      brief: String(formData.get("brief") ?? "").trim(),
      finish_cta: String(formData.get("finish_cta") ?? "").trim(),
      production_notes: String(formData.get("production_notes") ?? "").trim(),
      owner_name: ownerName,
      due_date: String(formData.get("due_date") ?? "").trim() || null,
      created_by: user?.id ?? null,
    });
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

export async function updateProductionAssetField(
  clientId: string,
  assetId: string,
  field: "title" | "kind" | "status" | "hook" | "brief" | "finish_cta" | "production_notes" | "owner_name" | "due_date",
  value: string
): Promise<ActionResult> {
  if (field === "status" && !PRODUCTION_ASSET_STATUS.some((s) => s.value === value)) {
    return { ok: false, message: "That isn't a valid asset status." };
  }
  if (field === "kind" && !PRODUCTION_ASSET_KIND.some((k) => k.value === value)) {
    return { ok: false, message: "That isn't a valid asset type." };
  }
  return runAction(async () => {
    const supabase = await createClient();
    const patch: AssetUpdate = {
      ...fieldPatch<AssetUpdate>(field, field === "due_date" ? value || null : value),
      updated_at: new Date().toISOString(),
    };
    // Completing an asset stamps when — the run sheet and the eventual
    // Actions automation both key on it rather than on the status alone.
    if (field === "status") patch.completed_at = value === "complete" ? new Date().toISOString() : null;

    const { error } = await supabase.from("production_assets").update(patch).eq("id", assetId).eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

export async function deleteProductionAsset(clientId: string, assetId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("production_assets").delete().eq("id", assetId).eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateProduction(clientId);
    return undefined;
  });
}

/**
 * Which platform versions an asset feeds — the many-to-many Duane asked to
 * future-proof. Set as a whole list rather than added one at a time, so the
 * checkbox grid in the UI maps straight onto it.
 */
export async function setAssetOutputs(clientId: string, assetId: string, outputIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: asset } = await supabase
      .from("production_assets")
      .select("id")
      .eq("id", assetId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!asset) throw new UserFacingError("That asset doesn't exist for this client.");

    const { error: clearError } = await supabase.from("production_asset_outputs").delete().eq("asset_id", assetId);
    if (clearError) throw new UserFacingError(clearError.message);

    if (outputIds.length > 0) {
      const { error } = await supabase
        .from("production_asset_outputs")
        .insert(outputIds.map((outputId) => ({ asset_id: assetId, output_id: outputId })));
      if (error) throw new UserFacingError(error.message);
    }
    revalidateProduction(clientId);
    return undefined;
  });
}

/**
 * The one-click path from Content (Duane): select approved Master Ideas,
 * pick or create the day, done. No opening each idea, no per-idea form.
 *
 * Creating the day and attaching in a single action is deliberate — the
 * point is that ten ideas cost one decision, not eleven.
 */
export async function addContentToProduction(
  clientId: string,
  contentIds: string[],
  target: { jobId: string } | { title: string; productionDate: string; startTime?: string; location?: string; ownerName?: string }
): Promise<ActionResult<{ jobId: string; attached: number; assetsCreated: number }>> {
  return runAction(async () => {
    if (contentIds.length === 0) throw new UserFacingError("Select at least one piece of content.");
    const supabase = await createClient();

    let jobId: string;
    if ("jobId" in target) {
      jobId = target.jobId;
    } else {
      if (!target.title.trim()) throw new UserFacingError("Give the production day a name.");
      if (!target.productionDate) throw new UserFacingError("A production date is required.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from("production_jobs")
        .insert({
          client_id: clientId,
          title: target.title.trim(),
          production_date: target.productionDate,
          scheduled_at: target.startTime ? new Date(`${target.productionDate}T${target.startTime}`).toISOString() : null,
          location: target.location?.trim() ?? "",
          default_owner_name: target.ownerName?.trim() ?? "",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw new UserFacingError(error.message);
      jobId = created.id;
    }

    const result = await addIdeasToJob(clientId, jobId, contentIds);
    if (!result.ok) throw new UserFacingError(result.message);
    return { jobId, attached: result.data.attached, assetsCreated: result.data.assetsCreated };
  });
}
