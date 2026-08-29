"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

const FIELDS = [
  "platform",
  "account_name",
  "owner_brand",
  "url",
  "account_type",
  "account_status",
  "objective",
  "audience",
  "content_types",
  "posting_frequency",
  "growth_strategy",
  "engagement_strategy",
  "cta_strategy",
  // Platform Strategy Profile (migration 0023) — how this platform is used,
  // not just where it is.
  "platform_role",
  "tone_voice",
  "preferred_formats",
  "content_length",
  "hook_guidance",
  "commercial_ratio",
  "platform_exclusions",
  "repurposing_rules",
  "cross_post_rule",
  "cadence_period",
  "ai_instructions",
] as const;
type Field = (typeof FIELDS)[number];

const TOGGLES = ["is_primary", "show_on_overview", "publishing_enabled"] as const;
type Toggle = (typeof TOGGLES)[number];

function revalidateSocial(clientId: string) {
  revalidatePath(`/clients/${clientId}/social`);
  // The Overview displays Social records now (single source of truth).
  revalidatePath(`/clients/${clientId}`, "layout");
}

export async function createSocialStrategy(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const platform = String(formData.get("platform") ?? "").trim();
  const accountName = String(formData.get("account_name") ?? "").trim();
  if (!platform) return { ok: false, message: "Platform is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_strategies")
      .insert({ client_id: clientId, platform, account_name: accountName });
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

export async function updateSocialStrategyField(
  clientId: string,
  strategyId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "platform" && !value.trim()) return { ok: false, message: "Platform can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_strategies")
      .update(fieldPatch<Database["public"]["Tables"]["social_strategies"]["Update"]>(field, value))
      .eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

/** The account switches: primary, show on Overview, publishing enabled. */
export async function toggleSocialAccountFlag(
  clientId: string,
  strategyId: string,
  flag: Toggle,
  value: boolean
): Promise<ActionResult> {
  if (!TOGGLES.includes(flag)) return { ok: false, message: "Unknown setting." };
  return runAction(async () => {
    const supabase = await createClient();
    const patch: Database["public"]["Tables"]["social_strategies"]["Update"] = { [flag]: value };
    const { error } = await supabase.from("social_strategies").update(patch).eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

/** Cadence is a number, not prose — it's what makes planned-vs-target
 * possible. 0 means "no target set", which is not the same as zero posts. */
export async function setSocialCadence(
  clientId: string,
  strategyId: string,
  target: number,
  period: string
): Promise<ActionResult> {
  if (!Number.isFinite(target) || target < 0) return { ok: false, message: "Cadence must be zero or more." };
  if (period !== "week" && period !== "month") return { ok: false, message: "Cadence period must be per week or per month." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_strategies")
      .update({ cadence_target: Math.round(target), cadence_period: period })
      .eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

/** Point an account at one of the client's real audiences, rather than
 * describing it again in prose. */
export async function setSocialAudienceLink(
  clientId: string,
  strategyId: string,
  slot: "primary" | "secondary",
  audienceId: string | null
): Promise<ActionResult> {
  if (slot !== "primary" && slot !== "secondary") return { ok: false, message: "Unknown audience slot." };
  return runAction(async () => {
    const supabase = await createClient();
    const column = slot === "primary" ? "primary_audience_id" : "secondary_audience_id";
    const patch: Database["public"]["Tables"]["social_strategies"]["Update"] = { [column]: audienceId };
    const { error } = await supabase.from("social_strategies").update(patch).eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

export async function deleteSocialStrategy(clientId: string, strategyId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("social_strategies").delete().eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}
