"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { fieldPatch } from "@/lib/field-patch";
import { buildAccountResolver, normaliseAccountKey } from "@/lib/social-match";
import { assessPlatformFit, cadenceStatus, cadenceLabel } from "@/lib/platform-strategy";
import type { Database } from "@/lib/database.types";
import {
  MONTHLY_PLAN_STATUS,
  REQUIREMENT_TYPE,
  REQUIREMENT_STATE,
  MEDIA_STATE,
  type MonthlyPlanStatus,
  type RequirementType,
} from "@/lib/status";
import { periodMonthLabel, planSequenceLabel, isPlatformExcluded, platformLabel } from "@/lib/monthly-plan-format";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidatePlan(clientId: string, planId?: string) {
  revalidatePath(`/clients/${clientId}/plans`);
  if (planId) revalidatePath(`/clients/${clientId}/plans/${planId}`);
  revalidatePath(`/clients/${clientId}/content`);
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Client Snapshot — the auto-pulled half. Frozen into monthly_plans.snapshot
// at creation time (see the migration's own comment on that column); this
// builder is also what a manual "refresh" re-runs, never anything automatic.
// ---------------------------------------------------------------------------

export interface MonthlyPlanSnapshot {
  audiences: { name: string; description: string; pain_points: string; goals: string; content_interests: string }[];
  pillars: { name: string; description: string; purpose: string; key_messages: string }[];
  platforms: {
    platform: string;
    account_name: string | null;
    objective: string;
    cadence_target: number | null;
    cadence_period: string | null;
    tone_voice: string;
    cta_strategy: string;
    hook_guidance: string;
  }[];
}

async function buildSnapshot(supabase: SupabaseClient, clientId: string): Promise<MonthlyPlanSnapshot> {
  const [{ data: audiences }, { data: pillars }, { data: socials }] = await Promise.all([
    supabase
      .from("audiences")
      .select("name,description,pain_points,goals,content_interests")
      .eq("client_id", clientId)
      .order("sort_order"),
    supabase.from("brand_pillars").select("name,description,purpose,key_messages").eq("client_id", clientId).order("sort_order"),
    supabase
      .from("social_strategies")
      .select("platform,account_name,objective,cadence_target,cadence_period,tone_voice,cta_strategy,hook_guidance")
      .eq("client_id", clientId)
      .order("sort_order"),
  ]);
  return {
    audiences: (audiences ?? []).map((a) => ({ ...a })),
    pillars: (pillars ?? []).map((p) => ({ ...p })),
    platforms: (socials ?? []).map((s) => ({ ...s })),
  };
}

// ---------------------------------------------------------------------------
// Readiness check (Duane, testing Daniel's October plan): PBOS must not
// generate off incomplete client intelligence — a blank field is never
// silently "excluded" and never something the AI is left to guess. Every
// active platform gets one of three states: ready, excluded (the client's
// own strategy has ruled it out — never offered as a destination), or
// active-but-incomplete (a blank cadence on a live platform is exactly the
// case that must block, not slide through as if excluded).
// ---------------------------------------------------------------------------

export interface PlatformReadiness {
  id: string;
  label: string;
  state: "ready" | "excluded" | "incomplete";
  missing: string[];
}

export interface MonthlyPlanReadiness {
  ready: boolean;
  blockers: string[];
  platforms: PlatformReadiness[];
}

async function checkReadinessInternal(supabase: SupabaseClient, clientId: string): Promise<MonthlyPlanReadiness> {
  const [{ data: client }, { data: guidelines }, { data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
    supabase.from("clients").select("north_star").eq("id", clientId).maybeSingle(),
    supabase.from("content_guidelines").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("brand_pillars").select("id").eq("client_id", clientId),
    supabase.from("audiences").select("id").eq("client_id", clientId),
    supabase.from("social_strategies").select("*").eq("client_id", clientId),
  ]);

  const blockers: string[] = [];
  if (!client?.north_star?.trim()) blockers.push("Primary objective missing.");
  if ((pillars ?? []).length === 0) blockers.push("No approved content pillars set up.");
  if ((audiences ?? []).length === 0) blockers.push("No audiences set up.");
  if (!guidelines?.cta_priorities?.trim()) blockers.push("CTA priorities / direction missing.");
  if (!guidelines?.tone_voice_notes?.trim()) blockers.push("Tone / voice guidance missing.");

  const platforms: PlatformReadiness[] = (socials ?? []).map((account) => {
    const label = platformLabel(account);
    if (isPlatformExcluded(account)) return { id: account.id, label, state: "excluded", missing: [] };

    const missing: string[] = [];
    if (!account.objective.trim()) missing.push("objective / role");
    if (!(account.cadence_target > 0)) missing.push("cadence");
    if (!account.tone_voice.trim()) missing.push("tone / voice guidance");
    if (!account.primary_audience_id && !account.audience.trim()) missing.push("audience / strategic role");

    if (missing.length > 0) {
      for (const field of missing) blockers.push(`${label}: ${field} missing`);
      return { id: account.id, label, state: "incomplete", missing };
    }
    return { id: account.id, label, state: "ready", missing: [] };
  });

  return { ready: blockers.length === 0, blockers, platforms };
}

export async function checkMonthlyPlanReadiness(clientId: string): Promise<ActionResult<MonthlyPlanReadiness>> {
  return runAction(async () => {
    const supabase = await createClient();
    return checkReadinessInternal(supabase, clientId);
  });
}

// ---------------------------------------------------------------------------
// The plan itself
// ---------------------------------------------------------------------------

export async function createMonthlyPlan(clientId: string, periodMonth: string): Promise<ActionResult<{ id: string }>> {
  const match = /^(\d{4})-(\d{2})/.exec(periodMonth.trim());
  if (!match) return { ok: false, message: "Pick a month." };
  const normalised = `${match[1]}-${match[2]}-01`;

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [{ data: client }, { data: guidelines }, snapshot] = await Promise.all([
      supabase.from("clients").select("north_star").eq("id", clientId).maybeSingle(),
      supabase.from("content_guidelines").select("*").eq("client_id", clientId).maybeSingle(),
      buildSnapshot(supabase, clientId),
    ]);

    const { data, error } = await supabase
      .from("monthly_plans")
      .insert({
        client_id: clientId,
        period_month: normalised,
        // Best-effort starting points inherited from the permanent client
        // profile, not reconstructed from nothing — a strategist edits these
        // fresh each month from here; never re-pulled automatically
        // afterwards. scope_status stays blank: month-specific by design.
        primary_objective: client?.north_star ?? "",
        secondary_objectives: guidelines?.secondary_objectives ?? "",
        global_tone_notes: guidelines?.tone_voice_notes ?? "",
        preferred_language: guidelines?.preferred_language ?? "",
        avoid_language: guidelines?.avoid_language ?? "",
        cta_priorities: guidelines?.cta_priorities ?? "",
        primary_cta_destination: guidelines?.primary_cta_destination ?? "",
        snapshot: snapshot as unknown as Database["public"]["Tables"]["monthly_plans"]["Insert"]["snapshot"],
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.toLowerCase().includes("duplicate key")) {
        throw new UserFacingError(`This client already has a Monthly Plan for ${periodMonthLabel(normalised)}.`);
      }
      throw new Error(error.message);
    }
    revalidatePlan(clientId);
    return { id: data.id };
  });
}

const PLAN_TEXT_FIELDS = [
  "primary_objective",
  "secondary_objectives",
  "global_tone_notes",
  "preferred_language",
  "avoid_language",
  "cta_priorities",
  "primary_cta_destination",
  "scope_status",
] as const;
type PlanTextField = (typeof PLAN_TEXT_FIELDS)[number];

export async function updateMonthlyPlanField(
  clientId: string,
  planId: string,
  field: PlanTextField,
  value: string
): Promise<ActionResult> {
  if (!PLAN_TEXT_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("monthly_plans")
      .update(fieldPatch<Database["public"]["Tables"]["monthly_plans"]["Update"]>(field, value))
      .eq("id", planId)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return undefined;
  });
}

export async function updateMonthlyPlanStatus(clientId: string, planId: string, status: MonthlyPlanStatus): Promise<ActionResult> {
  if (!MONTHLY_PLAN_STATUS.some((s) => s.value === status)) return { ok: false, message: "Invalid status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("monthly_plans").update({ status }).eq("id", planId).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return undefined;
  });
}

/** Explicit re-pull of the auto-pulled half of the Client Snapshot. Never
 * called automatically — the whole point of freezing it at creation is that
 * it doesn't silently drift as the live profile changes underneath it. */
export async function refreshMonthlyPlanSnapshot(clientId: string, planId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const snapshot = await buildSnapshot(supabase, clientId);
    const { error } = await supabase
      .from("monthly_plans")
      .update({ snapshot: snapshot as unknown as Database["public"]["Tables"]["monthly_plans"]["Update"]["snapshot"] })
      .eq("id", planId)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return undefined;
  });
}

export async function deleteMonthlyPlan(clientId: string, planId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("monthly_plans").delete().eq("id", planId).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Master Content — content_ideas scoped to a plan. Deleting an idea (any
// origin) reuses deleteContentIdea from lib/actions/content.ts rather than
// duplicating it here.
// ---------------------------------------------------------------------------

async function nextPlanSequence(supabase: SupabaseClient, planId: string): Promise<number> {
  const { data } = await supabase
    .from("content_ideas")
    .select("plan_sequence")
    .eq("monthly_plan_id", planId)
    .order("plan_sequence", { ascending: false })
    .limit(1);
  return (data?.[0]?.plan_sequence ?? 0) + 1;
}

export async function addPlanContentIdea(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const planId = String(formData.get("monthly_plan_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };
  const pillarId = String(formData.get("pillar_id") ?? "") || null;
  const audienceId = String(formData.get("audience_id") ?? "") || null;
  const leadPlatformId = String(formData.get("lead_platform_id") ?? "") || null;

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [sequence, { data: leadAccount }] = await Promise.all([
      nextPlanSequence(supabase, planId),
      leadPlatformId
        ? supabase.from("social_strategies").select("platform,account_name").eq("id", leadPlatformId).eq("client_id", clientId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const { error } = await supabase.from("content_ideas").insert({
      client_id: clientId,
      monthly_plan_id: planId,
      plan_sequence: sequence,
      title,
      pillar_id: pillarId,
      audience_id: audienceId,
      core_message: String(formData.get("core_message") ?? "").trim(),
      purpose: String(formData.get("purpose") ?? "").trim(),
      hook: String(formData.get("hook") ?? "").trim(),
      cta: String(formData.get("cta") ?? "").trim(),
      cta_destination: String(formData.get("cta_destination") ?? "").trim(),
      lead_platform_id: leadPlatformId,
      lead_platform: leadAccount ? platformLabel(leadAccount) : "",
      origin: "manual",
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return undefined;
  });
}

const PLAN_CONTENT_FIELDS = [
  "title",
  "core_message",
  "purpose",
  "hook",
  "cta",
  "cta_destination",
  "lead_draft_copy",
  "body",
  "notes",
  "pillar_id",
  "audience_id",
] as const;
type PlanContentField = (typeof PLAN_CONTENT_FIELDS)[number];
const NULLABLE_PLAN_CONTENT_FIELDS: PlanContentField[] = ["pillar_id", "audience_id"];

export async function updatePlanContentIdeaField(
  clientId: string,
  ideaId: string,
  field: PlanContentField,
  value: string
): Promise<ActionResult> {
  if (!PLAN_CONTENT_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "Title can't be empty." };
  return runAction(async () => {
    const supabase = await createClient();
    const patchValue: string | null = NULLABLE_PLAN_CONTENT_FIELDS.includes(field) ? value || null : value;
    const { error } = await supabase
      .from("content_ideas")
      .update(fieldPatch<Database["public"]["Tables"]["content_ideas"]["Update"]>(field, patchValue))
      .eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return undefined;
  });
}

/** Lead platform is a select against real accounts, not free text — set
 * lead_platform_id and lead_platform (the display label) together so they
 * never drift apart. */
export async function updatePlanContentLeadPlatform(clientId: string, ideaId: string, leadPlatformId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    let label = "";
    if (leadPlatformId) {
      const { data: account } = await supabase
        .from("social_strategies")
        .select("platform,account_name")
        .eq("id", leadPlatformId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!account) throw new Error("That platform doesn't belong to this client.");
      label = platformLabel(account);
    }
    const { error } = await supabase
      .from("content_ideas")
      .update({ lead_platform_id: leadPlatformId, lead_platform: label })
      .eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export async function addRequirement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const planId = String(formData.get("monthly_plan_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { ok: false, message: "Description is required." };
  const type = (String(formData.get("type") ?? "other") || "other") as RequirementType;
  if (!REQUIREMENT_TYPE.some((t) => t.value === type)) return { ok: false, message: "Invalid type." };
  const dueDate = String(formData.get("due_date") ?? "") || null;

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("monthly_plan_requirements").insert({
      client_id: clientId,
      monthly_plan_id: planId,
      type,
      description,
      owner_note: String(formData.get("owner_note") ?? "").trim(),
      due_date: dueDate,
      related_content_note: String(formData.get("related_content_note") ?? "").trim(),
    });
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return undefined;
  });
}

const REQUIREMENT_FIELDS = ["type", "description", "owner_note", "due_date", "state", "related_content_note"] as const;
type RequirementField = (typeof REQUIREMENT_FIELDS)[number];
const NULLABLE_REQUIREMENT_FIELDS: RequirementField[] = ["due_date"];

export async function updateRequirementField(
  clientId: string,
  requirementId: string,
  field: RequirementField,
  value: string
): Promise<ActionResult> {
  if (!REQUIREMENT_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "type" && !REQUIREMENT_TYPE.some((t) => t.value === value)) return { ok: false, message: "Invalid type." };
  if (field === "state" && !REQUIREMENT_STATE.some((s) => s.value === value)) return { ok: false, message: "Invalid state." };
  return runAction(async () => {
    const supabase = await createClient();
    const patchValue: string | null = NULLABLE_REQUIREMENT_FIELDS.includes(field) ? value || null : value;
    const { error } = await supabase
      .from("monthly_plan_requirements")
      .update(fieldPatch<Database["public"]["Tables"]["monthly_plan_requirements"]["Update"]>(field, patchValue))
      .eq("id", requirementId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return undefined;
  });
}

export async function deleteRequirement(clientId: string, requirementId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("monthly_plan_requirements").delete().eq("id", requirementId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// System-generated requirements (Duane, testing Daniel's October plan): PBOS
// computes production needs from the plan's actual Master Content / Platform
// Outputs rather than trusting a freeform list — "if six Reels are planned,
// the filming requirement must account for those six Reels" — plus flags
// anything contradictory (a declared lead platform with no matching output,
// a platform the client's strategy excludes, an off-cadence platform, a CTA
// with no destination). Recomputed on demand: a condition that no longer
// holds has its row removed, never left stale: origin='system_generated'
// rows are the only ones this touches, keyed by `generated_key` so a rerun
// updates in place instead of duplicating.
// ---------------------------------------------------------------------------

type DesiredRequirement = { type: RequirementType; description: string; related_content_note: string };

async function reconcilePlanRequirementsInternal(
  supabase: SupabaseClient,
  clientId: string,
  planId: string
): Promise<{ created: number; updated: number; removed: number }> {
  const [{ data: ideas }, { data: existingReqs }, { data: socials }] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("id,plan_sequence,title,lead_platform,lead_platform_id,cta,cta_destination")
      .eq("monthly_plan_id", planId),
    supabase.from("monthly_plan_requirements").select("id,generated_key").eq("monthly_plan_id", planId).eq("origin", "system_generated"),
    supabase.from("social_strategies").select("*").eq("client_id", clientId),
  ]);
  const ideaList = ideas ?? [];
  const ideaIds = ideaList.map((i) => i.id);
  const { data: outputs } = ideaIds.length
    ? await supabase.from("content_outputs").select("id,content_id,platform,format,social_account_id").in("content_id", ideaIds)
    : { data: [] };
  const outputList = outputs ?? [];
  const socialList = socials ?? [];
  const socialById = new Map(socialList.map((s) => [s.id, s]));
  const resolveAccount = buildAccountResolver(socialList);
  const ideaById = new Map(ideaList.map((i) => [i.id, i]));

  const accountFor = (output: { social_account_id: string | null; platform: string }) =>
    (output.social_account_id ? socialById.get(output.social_account_id) : undefined) ?? resolveAccount(output.platform, output.platform);

  const desired = new Map<string, DesiredRequirement>();

  // a) Aggregate production needs by format — grouped across whichever
  // platforms use it, since a shoot usually covers every platform at once,
  // not a separate one per platform.
  const byFormat = new Map<string, { count: number; seqs: Set<string>; labels: Set<string> }>();
  for (const output of outputList) {
    const format = output.format.trim();
    if (!format) continue;
    const key = format.toLowerCase();
    const bucket = byFormat.get(key) ?? { count: 0, seqs: new Set<string>(), labels: new Set<string>() };
    bucket.count += 1;
    const idea = ideaById.get(output.content_id);
    if (idea) bucket.seqs.add(planSequenceLabel(idea.plan_sequence));
    const account = accountFor(output);
    bucket.labels.add(account ? platformLabel(account) : output.platform);
    byFormat.set(key, bucket);
  }
  for (const [key, bucket] of byFormat) {
    const isFilming = /film|record|shoot|reel|video|short|clip|live/i.test(key);
    const isAsset = /image|photo|graphic|carousel|design|thumbnail|banner|infograph|static/i.test(key);
    desired.set(`format:${key}`, {
      type: isFilming ? "filming" : isAsset ? "asset_upload" : "other",
      description: `${isFilming ? "Film" : "Source"} ${bucket.count} × ${key} (${[...bucket.labels].sort().join(", ")})`,
      related_content_note: [...bucket.seqs].sort().join(", "),
    });
  }

  // b) A declared lead platform with no matching Platform Output yet.
  // Prefers the real lead_platform_id link; falls back to text matching for
  // ideas created before that column existed or added without one resolved.
  for (const idea of ideaList) {
    const leadPlatformText = idea.lead_platform.trim();
    if (!idea.lead_platform_id && !leadPlatformText) continue;
    const hasOutput = outputList.some((o) => {
      if (o.content_id !== idea.id) return false;
      const account = accountFor(o);
      if (idea.lead_platform_id) return account?.id === idea.lead_platform_id;
      return normaliseAccountKey(o.platform) === normaliseAccountKey(leadPlatformText);
    });
    if (!hasOutput) {
      const seq = planSequenceLabel(idea.plan_sequence);
      const label = idea.lead_platform_id ? (socialById.get(idea.lead_platform_id) ? platformLabel(socialById.get(idea.lead_platform_id)!) : leadPlatformText) : leadPlatformText;
      desired.set(`leadplatform:${idea.id}`, {
        type: "decision_approval",
        description: `${seq} "${idea.title}" declares lead platform "${label}" but has no Platform Output for it yet.`,
        related_content_note: seq,
      });
    }
  }

  // c) A CTA with no destination — never invented, always surfaced.
  for (const idea of ideaList) {
    if (idea.cta.trim() && !idea.cta_destination.trim()) {
      const seq = planSequenceLabel(idea.plan_sequence);
      desired.set(`ctadest:${idea.id}`, {
        type: "information",
        description: `${seq} "${idea.title}" has a CTA but no destination set.`,
        related_content_note: seq,
      });
    }
  }

  // d) Outputs planned on no matching account, an account the strategy
  // excludes, or off that account's cadence target.
  const byAccountId = new Map<string, number>();
  const unmatchedPlatforms = new Map<string, number>();
  for (const output of outputList) {
    const account = accountFor(output);
    if (account) {
      byAccountId.set(account.id, (byAccountId.get(account.id) ?? 0) + 1);
    } else {
      const label = output.platform.trim() || "(no platform set)";
      unmatchedPlatforms.set(label, (unmatchedPlatforms.get(label) ?? 0) + 1);
    }
  }
  for (const [platform, count] of unmatchedPlatforms) {
    desired.set(`platform_unmatched:${normaliseAccountKey(platform)}`, {
      type: "decision_approval",
      description: `No account set up for "${platform}" on the Social tab, but ${count} Platform Output(s) are planned there.`,
      related_content_note: "",
    });
  }
  for (const [accountId, count] of byAccountId) {
    const account = socialById.get(accountId);
    if (!account) continue;
    const label = platformLabel(account);
    const verdict = assessPlatformFit(account);
    if (verdict.decision === "exclude") {
      desired.set(`platform_excluded:${accountId}`, {
        type: "decision_approval",
        description: `${count} Platform Output(s) planned for ${label}, but this account's strategy excludes master content here (${verdict.reason})`,
        related_content_note: "",
      });
    }
    const status = cadenceStatus(account, count);
    if (status.target !== null && status.state !== "on_track") {
      desired.set(`cadence:${accountId}`, {
        type: "information",
        description: `${label}: ${count} planned this month against a target of ${cadenceLabel(account)} — confirm this is intentional.`,
        related_content_note: "",
      });
    }
  }

  // Reconcile: remove what no longer applies, update what changed, create
  // what's new. Never touches a manual or ai_import row.
  const existing = existingReqs ?? [];
  const existingByKey = new Map(existing.filter((r) => r.generated_key).map((r) => [r.generated_key as string, r]));
  const staleIds = existing.filter((r) => r.generated_key && !desired.has(r.generated_key)).map((r) => r.id);
  if (staleIds.length > 0) {
    const { error } = await supabase.from("monthly_plan_requirements").delete().in("id", staleIds);
    if (error) throw new Error(error.message);
  }

  let created = 0;
  let updated = 0;
  for (const [key, value] of desired) {
    const match = existingByKey.get(key);
    if (match) {
      const { error } = await supabase
        .from("monthly_plan_requirements")
        .update({ type: value.type, description: value.description, related_content_note: value.related_content_note })
        .eq("id", match.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { error } = await supabase.from("monthly_plan_requirements").insert({
        monthly_plan_id: planId,
        client_id: clientId,
        type: value.type,
        description: value.description,
        related_content_note: value.related_content_note,
        state: "needs_confirmation",
        origin: "system_generated",
        generated_key: key,
      });
      if (error) throw new Error(error.message);
      created += 1;
    }
  }

  return { created, updated, removed: staleIds.length };
}

/** Manual trigger for the same pass importAiOutput runs automatically — for
 * after hand-editing Master Content or Platform Outputs. */
export async function reconcilePlanRequirements(
  clientId: string,
  planId: string
): Promise<ActionResult<{ created: number; updated: number; removed: number }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const result = await reconcilePlanRequirementsInternal(supabase, clientId, planId);
    revalidatePlan(clientId, planId);
    return result;
  });
}

// ---------------------------------------------------------------------------
// Publish-date assignment (Duane: PBOS distributes outputs across the month
// deterministically once it knows the month, the active platforms and their
// cadence — not the AI). Spaces each lead platform's Master Content evenly
// across the plan's calendar month, in plan_sequence order. Idempotent and
// re-runnable, same as reconcilePlanRequirements — safe to call again after
// hand-editing Master Content.
// ---------------------------------------------------------------------------

async function assignPlanPublishDatesInternal(
  supabase: SupabaseClient,
  clientId: string,
  planId: string
): Promise<{ assigned: number; skipped: number }> {
  const { data: plan } = await supabase.from("monthly_plans").select("period_month").eq("id", planId).eq("client_id", clientId).maybeSingle();
  if (!plan) throw new UserFacingError("Monthly Plan not found.");

  const { data: ideas } = await supabase
    .from("content_ideas")
    .select("id,plan_sequence,lead_platform_id")
    .eq("monthly_plan_id", planId)
    .order("plan_sequence");
  const ideaList = ideas ?? [];

  const [year, month] = plan.period_month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(year, month, 0).getDate();
  const yearMonth = plan.period_month.slice(0, 7);

  const byAccount = new Map<string, typeof ideaList>();
  let skipped = 0;
  for (const idea of ideaList) {
    if (!idea.lead_platform_id) {
      skipped += 1;
      continue;
    }
    const list = byAccount.get(idea.lead_platform_id) ?? [];
    list.push(idea);
    byAccount.set(idea.lead_platform_id, list);
  }

  let assigned = 0;
  for (const group of byAccount.values()) {
    const step = daysInMonth / group.length;
    for (let i = 0; i < group.length; i++) {
      const day = Math.min(daysInMonth, Math.max(1, Math.round(step * (i + 0.5))));
      const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
      const { error } = await supabase.from("content_ideas").update({ target_publish_date: date }).eq("id", group[i]!.id);
      if (error) throw new Error(error.message);
      assigned += 1;
    }
  }

  return { assigned, skipped };
}

/** Manual trigger for the same date-assignment pass importAiOutput runs
 * automatically — for after hand-adding or reassigning Master Content. */
export async function assignPlanPublishDates(clientId: string, planId: string): Promise<ActionResult<{ assigned: number; skipped: number }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const result = await assignPlanPublishDatesInternal(supabase, clientId, planId);
    revalidatePlan(clientId, planId);
    return result;
  });
}

// ---------------------------------------------------------------------------
// AI export / import (Duane, 5 Sep 2026, refined after the Daniel stress
// test). No Claude API call here — PBOS generates a brief, a person pastes
// it into Claude by hand, and pastes the JSON that comes back into
// importAiOutput. Claude does not own the data: this only ever proposes rows
// for PBOS to create, exactly as if a person had typed them in — never a
// live connection, and nothing is trusted without going through the same
// validation a person's input would.
//
// Pillars, audiences and platforms are referenced by stable id, never by
// display name — a name Claude normalises (spacing, punctuation, case) used
// to fail silently; an id either matches or it doesn't, so a mismatch is now
// a loud, pre-write validation error instead of a quietly unassigned field.
// ---------------------------------------------------------------------------

export interface AiBriefResult {
  brief: string;
}

/** The exact JSON shape importAiOutput expects, embedded in the brief so
 * Claude sees it verbatim rather than a paraphrase of it. Platform Outputs
 * carry an adaptation note, not a finished caption — Master Content is the
 * approval unit and owns the one full draft; hashtags are a post-approval
 * publishing detail, not part of planning. */
const OUTPUT_SCHEMA_EXAMPLE = {
  master_content: [
    {
      title: "string — the piece's working title",
      core_message: "string — the single-sentence takeaway",
      purpose: "string — why this piece exists",
      pillar_id: "string — one of the pillar ids listed below, or omit",
      audience_id: "string — one of the audience ids listed below, or omit",
      hook: "string — the opening line",
      cta: "string",
      cta_destination:
        "string — an actual destination ONLY if you were given one below; otherwise return exactly \"Needs confirmation\" — never construct or guess a URL",
      lead_platform_id: "string — one of the platform ids listed below",
      lead_draft_copy: "string — the one full draft of publish-ready copy, for the lead platform",
    },
  ],
  platform_outputs: [
    {
      master_index: "number — 1-based position in master_content above that this output belongs to",
      platform_id: "string — one of the platform ids listed below",
      format: "string",
      adaptation_note:
        "string — how this version should differ from the Master Content lead draft, e.g. \"Shorten for Instagram, make the opening more conversational, use the video hook on screen.\" Not a finished caption — that is written at production time, after approval.",
      media_brief: "string — what media this needs, described in words, before anyone sources or uploads it",
      destination_link: "string — optional, only if genuinely different from the Master Content CTA destination",
    },
  ],
  requirements: [
    {
      type: "one of: filming, asset_upload, information, decision_approval, access, other",
      description: "string",
      owner_note: "string — who this needs, e.g. \"Client\" or \"Daniel / Charlie\"",
      due_date: "YYYY-MM-DD — optional",
      related_content_note: "string — optional, e.g. \"MC-01, MC-02\" or \"All Instagram outputs\"",
    },
  ],
};

function lastDayOfMonth(periodMonth: string): number {
  const [year, month] = periodMonth.split("-").map(Number) as [number, number];
  return new Date(year, month, 0).getDate();
}

/** Generate the brief a person pastes into Claude — client context from the
 * Client Snapshot, plus the exact schema importAiOutput will validate
 * against. Refuses to generate off an incomplete profile (checkMonthlyPlanReadiness)
 * rather than let the AI guess. Nothing is written; this only reads. */
export async function exportAiBrief(clientId: string, planId: string): Promise<ActionResult<AiBriefResult>> {
  return runAction(async () => {
    const supabase = await createClient();

    const readiness = await checkReadinessInternal(supabase, clientId);
    if (!readiness.ready) {
      throw new UserFacingError(
        `Monthly Plan not ready:\n${readiness.blockers.map((b) => `- ${b}`).join("\n")}\n\nComplete these on the client's profile (Content Guidelines / Social tab) before generating.`
      );
    }

    const [{ data: client }, { data: plan }, { data: guidelines }, { data: pillars }, { data: audiences }, { data: socials }, { data: existingIdeas }] =
      await Promise.all([
        supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
        supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", clientId).maybeSingle(),
        supabase.from("content_guidelines").select("content_safeguards").eq("client_id", clientId).maybeSingle(),
        supabase.from("brand_pillars").select("id,name").eq("client_id", clientId).order("sort_order"),
        supabase.from("audiences").select("id,name").eq("client_id", clientId).order("sort_order"),
        supabase.from("social_strategies").select("*").eq("client_id", clientId).order("sort_order"),
        supabase.from("content_ideas").select("plan_sequence,title,core_message").eq("monthly_plan_id", planId).order("plan_sequence"),
      ]);
    if (!plan) throw new UserFacingError("Monthly Plan not found.");
    const snapshot = (plan.snapshot ?? {}) as unknown as MonthlyPlanSnapshot;
    // Only accounts this plan can actually use — excluded ones are never
    // offered as a destination, by id or by name.
    const activeSocials = (socials ?? []).filter((s) => !isPlatformExcluded(s));

    const lines: string[] = [];
    lines.push(`# ${client?.name ?? "Client"} — ${periodMonthLabel(plan.period_month)} Monthly Plan: AI Content Brief`);
    lines.push("");
    lines.push(
      "You are proposing structured content for this client's Monthly Plan inside PBOS (Personal Brand Operating System). PBOS owns the client record and this plan — you are only being asked to generate proposed structured content for a person to review and import into it. Return ONLY the JSON described at the end of this brief: no commentary, no markdown code fences, nothing before or after it."
    );
    lines.push("");
    lines.push(`## Planning period`);
    lines.push(`${periodMonthLabel(plan.period_month)}: ${plan.period_month.slice(0, 7)}-01 to ${plan.period_month.slice(0, 7)}-${String(lastDayOfMonth(plan.period_month)).padStart(2, "0")}.`);
    lines.push("PBOS assigns publish dates after import from cadence — do not propose or mention scheduling or specific dates.");
    lines.push("");

    if (guidelines?.content_safeguards?.trim()) {
      lines.push("## Hard constraints — non-negotiable");
      lines.push(guidelines.content_safeguards.trim());
      lines.push("");
    }

    lines.push("## Client Snapshot");
    lines.push(`Primary objective: ${plan.primary_objective || "(not set)"}`);
    if (plan.secondary_objectives) lines.push(`Secondary objectives: ${plan.secondary_objectives}`);
    if (plan.global_tone_notes) lines.push(`Tone / voice notes: ${plan.global_tone_notes}`);
    if (plan.preferred_language) lines.push(`Preferred language: ${plan.preferred_language}`);
    if (plan.avoid_language) lines.push(`Avoid: ${plan.avoid_language}`);
    if (plan.cta_priorities) lines.push(`CTA priorities: ${plan.cta_priorities}`);
    if (plan.primary_cta_destination) lines.push(`Primary CTA destination: ${plan.primary_cta_destination}`);
    if (plan.scope_status) lines.push(`Scope / status notes: ${plan.scope_status}`);
    lines.push("");

    lines.push("### Audiences");
    for (const a of snapshot.audiences ?? []) {
      const bits = [a.description, a.pain_points && `Pain points: ${a.pain_points}`, a.goals && `Goals: ${a.goals}`].filter(Boolean);
      lines.push(`- **${a.name}** — ${bits.join(" | ") || "—"}`);
    }
    lines.push("");
    lines.push("### Content pillars");
    for (const p of snapshot.pillars ?? []) {
      const bits = [p.description, p.purpose && `Purpose: ${p.purpose}`, p.key_messages && `Key messages: ${p.key_messages}`].filter(Boolean);
      lines.push(`- **${p.name}** — ${bits.join(" | ") || "—"}`);
    }
    lines.push("");
    lines.push("### Active platforms & rules (the only valid destinations)");
    for (const account of activeSocials) {
      const cadence = account.cadence_target ? `${account.cadence_target}/${account.cadence_period}` : "—";
      lines.push(
        `- **${platformLabel(account)}** — id: ${account.id}; objective: ${account.objective || "—"}; cadence: ${cadence}; tone: ${account.tone_voice || "—"}; CTA: ${account.cta_strategy || "—"}`
      );
    }
    lines.push("");

    if ((existingIdeas ?? []).length > 0) {
      lines.push("### Already planned this month — do not duplicate these");
      for (const idea of existingIdeas ?? []) {
        lines.push(`- ${planSequenceLabel(idea.plan_sequence)}: "${idea.title}" — ${idea.core_message || "(no core message set)"}`);
      }
      lines.push("");
    }

    lines.push("## What to return");
    lines.push("Return valid JSON only, matching this exact shape (this is a schema description, not literal values to copy):");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(OUTPUT_SCHEMA_EXAMPLE, null, 2));
    lines.push("```");
    lines.push("");
    lines.push("Pillar ids available:");
    for (const p of pillars ?? []) lines.push(`- ${p.id} = ${p.name}`);
    lines.push("");
    lines.push("Audience ids available:");
    for (const a of audiences ?? []) lines.push(`- ${a.id} = ${a.name}`);
    lines.push("");
    lines.push("Platform ids available (use for lead_platform_id and platform_outputs.platform_id — no other platform is valid for this plan):");
    for (const account of activeSocials) lines.push(`- ${account.id} = ${platformLabel(account)}`);

    return { brief: lines.join("\n") };
  });
}

export interface ImportAiOutputResult {
  masterContentCreated: number;
  platformOutputsCreated: number;
  requirementsCreated: number;
  /** Production requirements PBOS computed from the plan's actual Master
   * Content / Platform Outputs — aggregate format counts, a missing lead
   * platform output, a missing CTA destination, an excluded or off-cadence
   * platform. See reconcilePlanRequirements. */
  requirementsAutoGenerated: number;
  /** Master Content items PBOS assigned a publish date to from cadence. */
  datesAssigned: number;
  warnings: string[];
}

interface RawMasterContent {
  title?: unknown;
  core_message?: unknown;
  purpose?: unknown;
  pillar_id?: unknown;
  audience_id?: unknown;
  hook?: unknown;
  cta?: unknown;
  cta_destination?: unknown;
  lead_platform_id?: unknown;
  lead_draft_copy?: unknown;
}
interface RawPlatformOutput {
  master_index?: unknown;
  platform_id?: unknown;
  format?: unknown;
  adaptation_note?: unknown;
  media_brief?: unknown;
  destination_link?: unknown;
  media_state?: unknown;
}
interface RawRequirement {
  type?: unknown;
  description?: unknown;
  owner_note?: unknown;
  due_date?: unknown;
  related_content_note?: unknown;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Claude was told to write this exact phrase rather than invent a URL — a
 * hard rule, checked here too so an import can never quietly treat it as a
 * real destination. */
function normaliseCtaDestination(value: string): string {
  return value.toLowerCase() === "needs confirmation" ? "" : value;
}

/**
 * Validate and populate a Monthly Plan from Claude's pasted JSON. PBOS owns
 * every row this creates — nothing here is a live AI connection; the JSON is
 * validated exactly as strictly as a person's own input would be, pillar,
 * audience and platform ids are resolved against this client's real records
 * (never created to fit, and a mismatch fails the whole import rather than
 * silently dropping or guessing), and platform_outputs are linked back to
 * the master_content item they belong to by position in the same JSON, not
 * by guessing.
 */
export async function importAiOutput(clientId: string, planId: string, jsonText: string): Promise<ActionResult<ImportAiOutputResult>> {
  let parsed: unknown;
  try {
    // Claude sometimes wraps its JSON in a ```json fence despite being asked
    // not to — strip that cosmetic wrapper rather than reject an otherwise
    // good response.
    const cleaned = jsonText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, message: "That isn't valid JSON — paste exactly what Claude returned, nothing else." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, message: "Expected a JSON object with master_content / platform_outputs / requirements." };
  }

  const body = parsed as { master_content?: unknown; platform_outputs?: unknown; requirements?: unknown };
  const masterRaw = Array.isArray(body.master_content) ? (body.master_content as RawMasterContent[]) : [];
  const outputsRaw = Array.isArray(body.platform_outputs) ? (body.platform_outputs as RawPlatformOutput[]) : [];
  const requirementsRaw = Array.isArray(body.requirements) ? (body.requirements as RawRequirement[]) : [];

  if (masterRaw.length === 0 && outputsRaw.length === 0 && requirementsRaw.length === 0) {
    return { ok: false, message: "Nothing to import — the JSON has no master_content, platform_outputs, or requirements." };
  }

  const shapeErrors: string[] = [];
  masterRaw.forEach((item, i) => {
    if (!str(item.title)) shapeErrors.push(`master_content[${i}]: title is required.`);
  });
  outputsRaw.forEach((item, i) => {
    const idx = item.master_index;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 1 || idx > masterRaw.length) {
      shapeErrors.push(`platform_outputs[${i}]: master_index must be a whole number from 1 to ${masterRaw.length || "?"}, pointing at a master_content item.`);
    }
  });
  requirementsRaw.forEach((item, i) => {
    const type = str(item.type) || "other";
    if (!REQUIREMENT_TYPE.some((t) => t.value === type)) {
      shapeErrors.push(`requirements[${i}]: type "${str(item.type)}" isn't one of ${REQUIREMENT_TYPE.map((t) => t.value).join(", ")}.`);
    }
    if (!str(item.description)) shapeErrors.push(`requirements[${i}]: description is required.`);
  });
  if (shapeErrors.length > 0) {
    return { ok: false, message: `Couldn't import — fix these and try again:\n${shapeErrors.join("\n")}` };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: plan } = await supabase.from("monthly_plans").select("id").eq("id", planId).eq("client_id", clientId).maybeSingle();
    if (!plan) throw new UserFacingError("Monthly Plan not found.");

    const [{ data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
      supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
      supabase.from("audiences").select("id,name").eq("client_id", clientId),
      supabase.from("social_strategies").select("*").eq("client_id", clientId),
    ]);
    const pillarIds = new Set((pillars ?? []).map((p) => p.id));
    const audienceIds = new Set((audiences ?? []).map((a) => a.id));
    const socialById = new Map((socials ?? []).map((s) => [s.id, s]));

    // Fail visibly rather than silently dropping or guessing (Duane's
    // explicit ask): every id-shaped reference is checked against this
    // client's real records before anything is written.
    const idErrors: string[] = [];
    masterRaw.forEach((item, i) => {
      const label = `master_content[${i}] "${str(item.title)}"`;
      const pillarId = str(item.pillar_id);
      if (pillarId && !pillarIds.has(pillarId)) idErrors.push(`${label}: pillar_id "${pillarId}" doesn't match one of this client's approved pillars.`);
      const audienceId = str(item.audience_id);
      if (audienceId && !audienceIds.has(audienceId)) idErrors.push(`${label}: audience_id "${audienceId}" doesn't match one of this client's audiences.`);
      const leadPlatformId = str(item.lead_platform_id);
      if (leadPlatformId) {
        const account = socialById.get(leadPlatformId);
        if (!account) idErrors.push(`${label}: lead_platform_id "${leadPlatformId}" doesn't match a platform on this client's Social tab.`);
        else if (isPlatformExcluded(account)) idErrors.push(`${label}: lead_platform_id resolves to ${platformLabel(account)}, which is excluded for this plan.`);
      }
    });
    const seenOutputKeys = new Set<string>();
    outputsRaw.forEach((item, i) => {
      const label = `platform_outputs[${i}]`;
      const platformId = str(item.platform_id);
      if (!platformId) {
        idErrors.push(`${label}: platform_id is required.`);
        return;
      }
      const account = socialById.get(platformId);
      if (!account) {
        idErrors.push(`${label}: platform_id "${platformId}" doesn't match a platform on this client's Social tab.`);
        return;
      }
      if (isPlatformExcluded(account)) idErrors.push(`${label}: ${platformLabel(account)} is excluded for this plan — it must not be offered as a destination.`);
      const dupeKey = `${item.master_index}:${platformId}`;
      if (seenOutputKeys.has(dupeKey)) idErrors.push(`${label}: duplicate output for the same Master Content item and platform.`);
      seenOutputKeys.add(dupeKey);
      const mediaState = str(item.media_state);
      if (mediaState && !MEDIA_STATE.some((m) => m.value === mediaState)) {
        idErrors.push(`${label}: media_state "${mediaState}" isn't one of ${MEDIA_STATE.map((m) => m.value).join(", ")}.`);
      }
    });
    if (idErrors.length > 0) {
      throw new UserFacingError(`Couldn't import — fix these and try again:\n${idErrors.join("\n")}`);
    }

    const warnings: string[] = [];
    let sequence = await nextPlanSequence(supabase, planId);
    const masterIds: string[] = [];

    try {
      for (const item of masterRaw) {
        const leadPlatformId = str(item.lead_platform_id) || null;
        const leadAccount = leadPlatformId ? socialById.get(leadPlatformId) : undefined;

        const { data: row, error } = await supabase
          .from("content_ideas")
          .insert({
            client_id: clientId,
            monthly_plan_id: planId,
            plan_sequence: sequence,
            title: str(item.title),
            core_message: str(item.core_message),
            purpose: str(item.purpose),
            hook: str(item.hook),
            cta: str(item.cta),
            cta_destination: normaliseCtaDestination(str(item.cta_destination)),
            lead_platform_id: leadPlatformId,
            lead_platform: leadAccount ? platformLabel(leadAccount) : "",
            lead_draft_copy: str(item.lead_draft_copy),
            pillar_id: str(item.pillar_id) || null,
            audience_id: str(item.audience_id) || null,
            origin: "ai_import",
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw new Error(`"${str(item.title)}": ${error.message}`);
        masterIds.push(row.id);
        sequence += 1;
      }

      let outputsCreated = 0;
      for (const item of outputsRaw) {
        const idx = item.master_index as number;
        const contentId = masterIds[idx - 1];
        if (!contentId) {
          warnings.push(`A platform output referenced master_index ${idx}, which wasn't created — skipped.`);
          continue;
        }
        const account = socialById.get(str(item.platform_id))!;
        const verdict = assessPlatformFit(account);
        if (verdict.decision === "review") {
          warnings.push(`Output for master_index ${idx} on ${platformLabel(account)}: ${verdict.reason}`);
        }
        const mediaState = str(item.media_state) || "concept";
        const { error } = await supabase.from("content_outputs").insert({
          content_id: contentId,
          client_id: clientId,
          platform: account.platform,
          social_account_id: account.id,
          format: str(item.format),
          adaptation_note: str(item.adaptation_note),
          media_brief: str(item.media_brief),
          destination_link: str(item.destination_link),
          media_state: mediaState,
          origin: "ai_import",
        });
        if (error) throw new Error(`Platform output for master_index ${idx}: ${error.message}`);
        outputsCreated += 1;
      }

      let requirementsCreated = 0;
      for (const item of requirementsRaw) {
        const type = (str(item.type) || "other") as RequirementType;
        const dueDate = str(item.due_date);
        const { error } = await supabase.from("monthly_plan_requirements").insert({
          monthly_plan_id: planId,
          client_id: clientId,
          type,
          description: str(item.description),
          owner_note: str(item.owner_note),
          due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
          related_content_note: str(item.related_content_note),
          origin: "ai_import",
        });
        if (error) throw new Error(`Requirement "${str(item.description)}": ${error.message}`);
        requirementsCreated += 1;
      }

      // PBOS assigns dates from cadence — best-effort: a hiccup here
      // shouldn't undo an otherwise good import.
      let datesAssigned = 0;
      try {
        const dated = await assignPlanPublishDatesInternal(supabase, clientId, planId);
        datesAssigned = dated.assigned;
      } catch (dateError) {
        warnings.push(`Couldn't assign publish dates: ${dateError instanceof Error ? dateError.message : String(dateError)}`);
      }

      // Production requirements PBOS derives from what's actually planned —
      // also best-effort, and run after dates so its cadence math sees the
      // final picture.
      let requirementsAutoGenerated = 0;
      try {
        const reconciled = await reconcilePlanRequirementsInternal(supabase, clientId, planId);
        requirementsAutoGenerated = reconciled.created;
      } catch (reconcileError) {
        warnings.push(
          `Couldn't auto-generate production requirements: ${reconcileError instanceof Error ? reconcileError.message : String(reconcileError)}`
        );
      }

      revalidatePlan(clientId, planId);
      return {
        masterContentCreated: masterIds.length,
        platformOutputsCreated: outputsCreated,
        requirementsCreated,
        requirementsAutoGenerated,
        datesAssigned,
        warnings,
      };
    } catch (err) {
      // Best-understood as one logical transaction (commitClientImport's
      // pattern): if anything after the first insert fails, undo the master
      // content this call created — their outputs cascade with them — so a
      // retry doesn't leave a half-imported plan sitting alongside it.
      if (masterIds.length > 0) await supabase.from("content_ideas").delete().in("id", masterIds);
      throw err;
    }
  });
}

// ---------------------------------------------------------------------------
// Structured export (Duane, testing Daniel's October plan): the first PBOS
// output only needs to be the structured Monthly Plan itself — Client
// Snapshot, Master Content, Platform Outputs, Requirements, as one JSON
// document. No client-facing pack renderer yet; this is what gets used
// manually to prototype that, once the structure is validated.
// ---------------------------------------------------------------------------

export interface MonthlyPlanExport {
  client: { id: string; name: string };
  period_month: string;
  period_label: string;
  status: string;
  client_snapshot: {
    primary_objective: string;
    secondary_objectives: string;
    global_tone_notes: string;
    preferred_language: string;
    avoid_language: string;
    cta_priorities: string;
    primary_cta_destination: string;
    scope_status: string;
    auto_pulled: MonthlyPlanSnapshot;
  };
  master_content: {
    sequence: string;
    title: string;
    core_message: string;
    purpose: string;
    pillar: string | null;
    audience: string | null;
    hook: string;
    cta: string;
    cta_destination: string;
    lead_platform: string;
    lead_draft_copy: string;
    target_publish_date: string | null;
    status: string;
    origin: string;
    platform_outputs: {
      platform: string;
      format: string;
      caption: string;
      adaptation_note: string;
      destination_link: string;
      media_brief: string;
      media_state: string;
      status: string;
      origin: string;
    }[];
  }[];
  requirements: {
    type: string;
    description: string;
    owner_note: string;
    due_date: string | null;
    state: string;
    related_content_note: string;
    origin: string;
  }[];
  generated_at: string;
}

export async function exportMonthlyPlanJson(clientId: string, planId: string): Promise<ActionResult<{ json: string }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const [{ data: client }, { data: plan }, { data: pillars }, { data: audiences }, { data: ideas }, { data: requirements }] =
      await Promise.all([
        supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle(),
        supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", clientId).maybeSingle(),
        supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
        supabase.from("audiences").select("id,name").eq("client_id", clientId),
        supabase.from("content_ideas").select("*").eq("monthly_plan_id", planId).order("plan_sequence"),
        supabase.from("monthly_plan_requirements").select("*").eq("monthly_plan_id", planId).order("created_at"),
      ]);
    if (!client || !plan) throw new UserFacingError("Monthly Plan not found.");

    const ideaList = ideas ?? [];
    const ideaIds = ideaList.map((i) => i.id);
    const outputsResult = ideaIds.length
      ? await supabase.from("content_outputs").select("*").in("content_id", ideaIds).order("sort_order")
      : { data: [] as Database["public"]["Tables"]["content_outputs"]["Row"][] };
    const outputs = outputsResult.data;
    const outputsByIdea = new Map<string, NonNullable<typeof outputs>>();
    for (const output of outputs ?? []) {
      const list = outputsByIdea.get(output.content_id) ?? [];
      list.push(output);
      outputsByIdea.set(output.content_id, list);
    }
    const pillarNames = new Map((pillars ?? []).map((p) => [p.id, p.name]));
    const audienceNames = new Map((audiences ?? []).map((a) => [a.id, a.name]));

    const doc: MonthlyPlanExport = {
      client: { id: client.id, name: client.name },
      period_month: plan.period_month,
      period_label: periodMonthLabel(plan.period_month),
      status: plan.status,
      client_snapshot: {
        primary_objective: plan.primary_objective,
        secondary_objectives: plan.secondary_objectives,
        global_tone_notes: plan.global_tone_notes,
        preferred_language: plan.preferred_language,
        avoid_language: plan.avoid_language,
        cta_priorities: plan.cta_priorities,
        primary_cta_destination: plan.primary_cta_destination,
        scope_status: plan.scope_status,
        auto_pulled: (plan.snapshot ?? {}) as unknown as MonthlyPlanSnapshot,
      },
      master_content: ideaList.map((idea) => ({
        sequence: planSequenceLabel(idea.plan_sequence),
        title: idea.title,
        core_message: idea.core_message,
        purpose: idea.purpose,
        pillar: idea.pillar_id ? (pillarNames.get(idea.pillar_id) ?? null) : null,
        audience: idea.audience_id ? (audienceNames.get(idea.audience_id) ?? null) : null,
        hook: idea.hook,
        cta: idea.cta,
        cta_destination: idea.cta_destination,
        lead_platform: idea.lead_platform,
        lead_draft_copy: idea.lead_draft_copy,
        target_publish_date: idea.target_publish_date,
        status: idea.status,
        origin: idea.origin,
        platform_outputs: (outputsByIdea.get(idea.id) ?? []).map((output) => ({
          platform: output.platform,
          format: output.format,
          caption: output.caption,
          adaptation_note: output.adaptation_note,
          destination_link: output.destination_link,
          media_brief: output.media_brief,
          media_state: output.media_state,
          status: output.status,
          origin: output.origin,
        })),
      })),
      requirements: (requirements ?? []).map((r) => ({
        type: r.type,
        description: r.description,
        owner_note: r.owner_note,
        due_date: r.due_date,
        state: r.state,
        related_content_note: r.related_content_note,
        origin: r.origin,
      })),
      generated_at: new Date().toISOString(),
    };

    return { json: JSON.stringify(doc, null, 2) };
  });
}
