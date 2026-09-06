"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { fieldPatch } from "@/lib/field-patch";
import { buildAccountResolver, normaliseAccountKey } from "@/lib/social-match";
import { assessPlatformFit, cadenceStatus, cadenceLabel, monthlyTarget } from "@/lib/platform-strategy";
import type { Database } from "@/lib/database.types";
import {
  MONTHLY_PLAN_STATUS,
  REQUIREMENT_TYPE,
  REQUIREMENT_STATE,
  MEDIA_STATE,
  type MonthlyPlanStatus,
  type RequirementType,
} from "@/lib/status";
import {
  periodMonthLabel,
  planSequenceLabel,
  isPlatformExcluded,
  platformLabel,
  normaliseCtaDestination,
  ctaDestinationState,
  CTA_NEEDS_CONFIRMATION,
  isPlanLocked,
  CHANGE_REQUEST_FIELDS,
  type CtaDestinationState,
} from "@/lib/monthly-plan-format";
import { schedulePlanOutputs, normalisePostingDays, SIBLING_GAP_DAYS } from "@/lib/plan-scheduling";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidatePlan(clientId: string, planId?: string) {
  // Plan list and every plan page under it — the same Master Content record
  // is shown on the Content page too (two views, one record), so that
  // refreshes as well, plus the calendar which reads publish dates.
  revalidatePath(`/clients/${clientId}/plans`, "layout");
  if (planId) revalidatePath(`/clients/${clientId}/plans/${planId}`);
  revalidatePath(`/clients/${clientId}/content`);
  revalidatePath("/calendar");
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

/** Deleting a plan takes its own draft AI-imported content with it (Duane:
 * three deleted-and-recreated Septembers left 32 orphaned ideas on the
 * Content page — content_ideas.monthly_plan_id is `on delete set null`).
 * Hand-added content, and anything approved, scheduled or published, is
 * kept and simply unlinked, exactly as before. */
export async function deleteMonthlyPlan(clientId: string, planId: string): Promise<ActionResult<{ removed: number; kept: number }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const content = await classifyPlanContent(supabase, planId);
    if (content.replaceableIds.length > 0) {
      const { error } = await supabase.from("content_ideas").delete().in("id", content.replaceableIds);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from("monthly_plans").delete().eq("id", planId).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId);
    return { removed: content.replaceableIds.length, kept: content.locked + content.manual };
  });
}

// ---------------------------------------------------------------------------
// Import scope & revisions (Duane, after regenerating September three times
// stacked 48 ideas on the Content page). An import into a plan that already
// holds AI-imported content is a deliberate choice — replace the plan's own
// draft content, or add alongside it — never a silent append. "Replace" only
// ever removes Master Content that is (a) linked to THIS plan, (b) AI-
// imported, (c) still a draft, and (d) has nothing scheduled or published;
// another month's content, hand-added content and approved content are
// never touched. Once a plan is approved or active, replacing is no longer
// silent either: the current plan is snapshotted as a numbered revision, the
// revision counter moves on, and the plan drops back to In review.
// ---------------------------------------------------------------------------

export type ImportMode = "replace" | "add";

export interface PlanImportState {
  planStatus: MonthlyPlanStatus;
  revision: number;
  /** AI-imported Master Content still in draft — what "Replace" removes. */
  replaceable: number;
  /** AI-imported Master Content past draft, or with a scheduled/published
   * output — never replaced. */
  locked: number;
  /** Hand-added Master Content — never touched by an import. */
  manual: number;
  /** Approved/active plan: a replace snapshots the current plan as a
   * revision first. */
  requiresRevision: boolean;
  closed: boolean;
}

const REVISION_STATUSES: MonthlyPlanStatus[] = ["approved", "active"];

async function classifyPlanContent(
  supabase: SupabaseClient,
  planId: string
): Promise<{ replaceableIds: string[]; locked: number; manual: number }> {
  const { data: ideas } = await supabase.from("content_ideas").select("id,origin,status").eq("monthly_plan_id", planId);
  const ideaList = ideas ?? [];
  const ideaIds = ideaList.map((i) => i.id);
  const { data: outputs } = ideaIds.length
    ? await supabase.from("content_outputs").select("content_id,status,ayrshare_post_id").in("content_id", ideaIds)
    : { data: [] };
  const lockedByOutput = new Set(
    (outputs ?? []).filter((o) => o.status === "scheduled" || o.status === "published" || o.ayrshare_post_id !== "").map((o) => o.content_id)
  );
  const replaceableIds: string[] = [];
  let locked = 0;
  let manual = 0;
  for (const idea of ideaList) {
    if (idea.origin !== "ai_import") manual += 1;
    else if (idea.status !== "idea" || lockedByOutput.has(idea.id)) locked += 1;
    else replaceableIds.push(idea.id);
  }
  return { replaceableIds, locked, manual };
}

/** What an import into this plan would do — read by the import panel to
 * decide whether to ask Replace / Add / Cancel first. */
export async function getPlanImportState(clientId: string, planId: string): Promise<ActionResult<PlanImportState>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: plan } = await supabase.from("monthly_plans").select("status,revision").eq("id", planId).eq("client_id", clientId).maybeSingle();
    if (!plan) throw new UserFacingError("Monthly Plan not found.");
    const content = await classifyPlanContent(supabase, planId);
    const status = plan.status as MonthlyPlanStatus;
    return {
      planStatus: status,
      revision: plan.revision,
      replaceable: content.replaceableIds.length,
      locked: content.locked,
      manual: content.manual,
      requiresRevision: REVISION_STATUSES.includes(status),
      closed: status === "closed",
    };
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
    await assertIdeaEditable(supabase, ideaId);
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
    await assertIdeaEditable(supabase, ideaId);
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

/** The approval lock (Duane): Master Content on an approved / active /
 * closed plan is that month's approved version. A direct edit is refused and
 * pointed at change requests — applyChangeRequest is the one sanctioned path
 * that writes to a locked item. */
async function planStatusForIdea(supabase: SupabaseClient, ideaId: string): Promise<{ planId: string | null; status: string | null }> {
  const { data } = await supabase.from("content_ideas").select("monthly_plan_id, plan:monthly_plans(status)").eq("id", ideaId).maybeSingle();
  const plan = (data?.plan as { status: string } | null | undefined) ?? null;
  return { planId: data?.monthly_plan_id ?? null, status: plan?.status ?? null };
}

async function assertIdeaEditable(supabase: SupabaseClient, ideaId: string): Promise<void> {
  const { status } = await planStatusForIdea(supabase, ideaId);
  if (status && isPlanLocked(status)) {
    throw new UserFacingError("This Monthly Plan is approved — the approved version is locked. Raise a change request on this item instead.");
  }
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

/** Duane, round 3: format is now a constrained value on the generation
 * pathway (see PLATFORM_FORMATS below), so production requirements can
 * classify it exactly instead of guessing from free text. `null` means the
 * format genuinely needs no production requirement (a text post needs no
 * media). Anything not in this map — legacy or manual-entry data from
 * before the constraint existed — falls back to the old regex guess. */
const FORMAT_PRODUCTION_TYPE: Record<string, "filming" | "asset_upload" | null> = {
  video: "filming",
  reel: "filming",
  carousel: "asset_upload",
  static: "asset_upload",
  text_image: "asset_upload",
  text: null,
};

async function reconcilePlanRequirementsInternal(
  supabase: SupabaseClient,
  clientId: string,
  planId: string
): Promise<{ created: number; updated: number; removed: number }> {
  const [{ data: ideas }, { data: existingReqs }, { data: socials }, { data: pillars }] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("id,plan_sequence,title,lead_platform,lead_platform_id,cta,cta_destination,pillar_id")
      .eq("monthly_plan_id", planId),
    supabase.from("monthly_plan_requirements").select("id,generated_key").eq("monthly_plan_id", planId).eq("origin", "system_generated"),
    supabase.from("social_strategies").select("*").eq("client_id", clientId),
    supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
  ]);
  const ideaList = ideas ?? [];
  const pillarNameById = new Map((pillars ?? []).map((p) => [p.id, p.name]));
  const ideaIds = ideaList.map((i) => i.id);
  const { data: outputs } = ideaIds.length
    ? await supabase.from("content_outputs").select("id,content_id,platform,format,social_account_id,target_publish_date").in("content_id", ideaIds)
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
    if (FORMAT_PRODUCTION_TYPE[key] === null) continue; // e.g. "text" — no production requirement at all
    const bucket = byFormat.get(key) ?? { count: 0, seqs: new Set<string>(), labels: new Set<string>() };
    bucket.count += 1;
    const idea = ideaById.get(output.content_id);
    if (idea) bucket.seqs.add(planSequenceLabel(idea.plan_sequence));
    const account = accountFor(output);
    bucket.labels.add(account ? platformLabel(account) : output.platform);
    byFormat.set(key, bucket);
  }
  for (const [key, bucket] of byFormat) {
    const exact = FORMAT_PRODUCTION_TYPE[key];
    let type: RequirementType;
    if (exact !== undefined) {
      type = exact ?? "other"; // exact is never null here — null keys were skipped above
    } else {
      // Legacy / manual-entry format text from before the constraint existed.
      const isFilming = /film|record|shoot|reel|video|short|clip|live/i.test(key);
      const isAsset = /image|photo|graphic|carousel|design|thumbnail|banner|infograph|static/i.test(key);
      type = isFilming ? "filming" : isAsset ? "asset_upload" : "other";
    }
    desired.set(`format:${key}`, {
      type,
      description: `${type === "filming" ? "Film" : "Source"} ${bucket.count} × ${key} (${[...bucket.labels].sort().join(", ")})`,
      related_content_note: [...bucket.seqs].sort().join(", "),
    });
  }

  // b) A declared lead platform with no matching Platform Output yet —
  // grouped into one requirement listing every affected item (Duane: one
  // "confirm these" row, not one per Master Content). Prefers the real
  // lead_platform_id link; falls back to text matching for ideas created
  // before that column existed.
  const missingLeadOutput: string[] = [];
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
      const label = idea.lead_platform_id ? (socialById.get(idea.lead_platform_id) ? platformLabel(socialById.get(idea.lead_platform_id)!) : leadPlatformText) : leadPlatformText;
      missingLeadOutput.push(`${planSequenceLabel(idea.plan_sequence)} (${label})`);
    }
  }
  if (missingLeadOutput.length > 0) {
    desired.set("leadplatform:missing_output", {
      type: "decision_approval",
      description: `${missingLeadOutput.length} Master Content item(s) declare a lead platform but have no Platform Output for it yet.`,
      related_content_note: missingLeadOutput.sort().join(", "),
    });
  }

  // c) CTA destinations — two distinct states, each grouped into one row.
  // "Needs confirmation" is a state the AI set deliberately instead of
  // inventing a link; a blank next to a CTA is genuinely missing data.
  const ctaNeedsConfirmation: string[] = [];
  const ctaMissing: string[] = [];
  for (const idea of ideaList) {
    const state = ctaDestinationState(idea);
    if (state === "needs_confirmation") ctaNeedsConfirmation.push(planSequenceLabel(idea.plan_sequence));
    else if (state === "missing") ctaMissing.push(planSequenceLabel(idea.plan_sequence));
  }
  if (ctaNeedsConfirmation.length > 0) {
    desired.set("ctadest:needs_confirmation", {
      type: "information",
      description: `Confirm CTA destinations for ${ctaNeedsConfirmation.length} Master Content item(s) — flagged "${CTA_NEEDS_CONFIRMATION}" at generation rather than guessing a link.`,
      related_content_note: ctaNeedsConfirmation.sort().join(", "),
    });
  }
  if (ctaMissing.length > 0) {
    desired.set("ctadest:missing", {
      type: "information",
      description: `${ctaMissing.length} Master Content item(s) have a CTA but no destination set at all.`,
      related_content_note: ctaMissing.sort().join(", "),
    });
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

  // e) Pillar balance (Duane, round 3): flag concentration, don't block it —
  // "no more than three from one pillar unless the objective justifies it"
  // is a judgement call the strategist makes, not something PBOS can decide
  // on its own.
  const byPillar = new Map<string, Set<string>>();
  for (const idea of ideaList) {
    if (!idea.pillar_id) continue;
    const seqs = byPillar.get(idea.pillar_id) ?? new Set<string>();
    seqs.add(planSequenceLabel(idea.plan_sequence));
    byPillar.set(idea.pillar_id, seqs);
  }
  for (const [pillarId, seqs] of byPillar) {
    if (seqs.size <= 3) continue;
    const name = pillarNameById.get(pillarId) ?? "(unknown pillar)";
    desired.set(`pillar_balance:${pillarId}`, {
      type: "information",
      description: `${seqs.size} Master Content ideas use the "${name}" pillar this month — confirm this concentration is intentional. Guidance: no more than three from one pillar unless the month's objective clearly justifies it.`,
      related_content_note: [...seqs].sort().join(", "),
    });
  }

  // f) Sibling spacing (Duane, second full run): two outputs under one idea
  // in the same platform family on different accounts closer than the gap.
  // The scheduler already tries siblings first; if it still couldn't space
  // a group this stays visible here rather than being silently relaxed.
  const siblingGroups = new Map<string, { seq: string; days: number[] }>();
  for (const output of outputList) {
    if (!output.target_publish_date) continue;
    const account = accountFor(output);
    if (!account) continue;
    const idea = ideaById.get(output.content_id);
    if (!idea) continue;
    const key = `${output.content_id}:${normaliseAccountKey(account.platform)}:${account.id}`;
    const groupKey = key.slice(0, key.lastIndexOf(":"));
    const group = siblingGroups.get(groupKey) ?? { seq: planSequenceLabel(idea.plan_sequence), days: [] };
    group.days.push(Number(output.target_publish_date.slice(-2)));
    siblingGroups.set(groupKey, group);
  }
  const unspaced: string[] = [];
  for (const group of siblingGroups.values()) {
    if (group.days.length < 2) continue;
    const days = [...group.days].sort((a, b) => a - b);
    if (days.some((d, i) => i > 0 && d - days[i - 1]! < SIBLING_GAP_DAYS)) unspaced.push(group.seq);
  }
  if (unspaced.length > 0) {
    desired.set("sibling_spacing", {
      type: "information",
      description: `${unspaced.length} sibling group(s) could not be fully spaced within this planning period — same-idea outputs on the same platform land under ${SIBLING_GAP_DAYS} days apart. Adjust posting days or move one by hand.`,
      related_content_note: [...new Set(unspaced)].sort().join(", "),
    });
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
// cadence — not the AI). Dates live on each Platform Output, on the account
// it actually publishes to. After the first full run landed posts on every
// Sunday, the rules became account-level (lib/plan-scheduling.ts): spread
// each account's outputs across ITS posting days, one post per account per
// day, then keep same-idea siblings on the same platform family apart.
// content_ideas.target_publish_date is kept in sync afterwards, mirroring the
// lead platform's output, for the existing idea-level displays (cadence
// view, portal, publishing pack) that read it. Idempotent and re-runnable,
// same as reconcilePlanRequirements.
// ---------------------------------------------------------------------------

export interface AssignDatesResult {
  assigned: number;
  /** Outputs with no publishing account — can't be dated. */
  skipped: number;
  /** Outputs placed outside their account's posting days (month too full). */
  offPreferredDays: number;
  /** Outputs that had to share a day on one account (more outputs than days). */
  doubledUp: number;
  /** Sibling groups (same idea, same platform family) that could not be kept
   * apart within the month — never silently relaxed (Duane). */
  unspacedSiblingGroups: number;
}

async function assignPlanPublishDatesInternal(supabase: SupabaseClient, clientId: string, planId: string): Promise<AssignDatesResult> {
  const { data: plan } = await supabase.from("monthly_plans").select("period_month").eq("id", planId).eq("client_id", clientId).maybeSingle();
  if (!plan) throw new UserFacingError("Monthly Plan not found.");

  const [{ data: ideas }, { data: socials }] = await Promise.all([
    supabase.from("content_ideas").select("id,plan_sequence,lead_platform_id").eq("monthly_plan_id", planId).order("plan_sequence"),
    supabase.from("social_strategies").select("id,platform,posting_days").eq("client_id", clientId),
  ]);
  const ideaList = ideas ?? [];
  const ideaIds = ideaList.map((i) => i.id);
  const ideaSeqById = new Map(ideaList.map((i) => [i.id, i.plan_sequence ?? 0]));
  const socialById = new Map((socials ?? []).map((s) => [s.id, s]));

  const { data: outputs } = ideaIds.length
    ? await supabase.from("content_outputs").select("id,content_id,social_account_id,platform").in("content_id", ideaIds)
    : { data: [] };
  const outputList = outputs ?? [];

  const [year, month] = plan.period_month.split("-").map(Number) as [number, number];
  const yearMonth = plan.period_month.slice(0, 7);
  const formatDay = (day: number) => `${yearMonth}-${String(day).padStart(2, "0")}`;

  const result = schedulePlanOutputs({
    year,
    month,
    outputs: outputList.map((o) => {
      const account = o.social_account_id ? socialById.get(o.social_account_id) : undefined;
      return {
        id: o.id,
        contentId: o.content_id,
        accountId: account?.id ?? null,
        family: normaliseAccountKey(account?.platform ?? o.platform),
        sequence: ideaSeqById.get(o.content_id) ?? 0,
      };
    }),
    postingDaysByAccount: new Map((socials ?? []).map((s) => [s.id, normalisePostingDays(s.posting_days)])),
  });
  const dayFor = result.dayByOutput;

  let assigned = 0;
  for (const [outputId, day] of dayFor) {
    const { error } = await supabase.from("content_outputs").update({ target_publish_date: formatDay(day) }).eq("id", outputId);
    if (error) throw new Error(error.message);
    assigned += 1;
  }

  // Keep content_ideas.target_publish_date in sync — mirrors the lead
  // platform's own output date where one resolved, else the idea's
  // earliest-dated output. An idea with no dated outputs yet (e.g. just
  // hand-added, before any Platform Output exists) is left alone rather
  // than guessing a date for nothing to publish.
  for (const idea of ideaList) {
    const ideaOutputs = outputList.filter((o) => o.content_id === idea.id && dayFor.has(o.id));
    if (ideaOutputs.length === 0) continue;
    const leadOutput = idea.lead_platform_id ? ideaOutputs.find((o) => o.social_account_id === idea.lead_platform_id) : undefined;
    const day = leadOutput ? dayFor.get(leadOutput.id)! : Math.min(...ideaOutputs.map((o) => dayFor.get(o.id)!));
    const { error } = await supabase.from("content_ideas").update({ target_publish_date: formatDay(day) }).eq("id", idea.id);
    if (error) throw new Error(error.message);
  }

  return {
    assigned,
    skipped: result.skipped,
    offPreferredDays: result.offPreferredDays,
    doubledUp: result.doubledUp,
    unspacedSiblingGroups: result.unspacedSiblingGroups,
  };
}

/** Manual trigger for the same date-assignment pass importAiOutput runs
 * automatically — for after hand-adding or reassigning Master Content, or
 * after changing an account's posting days. */
export async function assignPlanPublishDates(clientId: string, planId: string): Promise<ActionResult<AssignDatesResult>> {
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

/** Duane, round 3: format now drives production Requirements directly, so
 * it can't be free text on the generation pathway — constrained to the
 * values each platform actually supports. Keyed by normalised platform name
 * (normaliseAccountKey), not display label, so "LinkedIn" and "linkedin —
 * daniel andrews" both resolve to the same entry. A platform with no entry
 * here is unconstrained — only LinkedIn and Instagram have a specified list
 * so far; a new platform stays open until Duane specifies its own. */
const PLATFORM_FORMATS: Record<string, string[]> = {
  linkedin: ["text", "text_image", "carousel", "video"],
  instagram: ["reel", "carousel", "static"],
};

function allowedFormatsFor(platform: string): string[] | null {
  return PLATFORM_FORMATS[normaliseAccountKey(platform)] ?? null;
}

/** Suggested Master-Content-idea-count range from a total Platform Output
 * target (Duane, round 3): calibrated so his own test numbers — 39 total
 * outputs — land on his own stated "14–16 ideas" (39 / 2.6 = 15.0, ±1). Not
 * a hard rule, just a starting steer for the brief. */
const AVG_OUTPUTS_PER_IDEA = 2.6;

/** The exact JSON shape importAiOutput expects, embedded in the brief so
 * Claude sees it verbatim rather than a paraphrase of it. Platform Outputs
 * carry an adaptation note, not a finished caption — Master Content is the
 * approval unit and owns the one full draft; hashtags are a post-approval
 * publishing detail, not part of planning. Requirements are never part of
 * this shape (Duane, round 3) — PBOS computes them itself, after import,
 * from what's actually planned; the AI is never asked for them. */
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
      format: "string — MUST be one of that platform's allowed formats, listed under \"Allowed formats per platform\" below — never freeform, this drives production Requirements",
      adaptation_note:
        "string — how this version should differ from the Master Content lead draft, e.g. \"Shorten for Instagram, make the opening more conversational, use the video hook on screen.\" Not a finished caption — that is written at production time, after approval.",
      media_brief: "string — what media this needs, described in words, before anyone sources or uploads it",
      destination_link: "string — optional, only if genuinely different from the Master Content CTA destination",
    },
  ],
};

function lastDayOfMonth(periodMonth: string): number {
  const [year, month] = periodMonth.split("-").map(Number) as [number, number];
  return new Date(year, month, 0).getDate();
}

interface BriefContext {
  clientName: string;
  plan: Database["public"]["Tables"]["monthly_plans"]["Row"];
  pillars: { id: string; name: string }[];
  eligibleAudiences: { id: string; name: string }[];
  activeSocials: Database["public"]["Tables"]["social_strategies"]["Row"][];
  existingIdeas: { id: string; plan_sequence: number | null; title: string; core_message: string }[];
  /** Everything from the title through the active-platform rules. */
  header: string[];
}

/** The client context every brief starts with — the full-plan brief and the
 * single-item briefs share it verbatim so a regenerated item is written
 * against exactly the same rules as the month it sits in. Refuses on an
 * incomplete profile (checkReadinessInternal) rather than let the AI guess. */
async function buildBriefContext(supabase: SupabaseClient, clientId: string, planId: string): Promise<BriefContext> {
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
      supabase
        .from("audiences")
        .select("id,name,description,pain_points,goals,eligible_for_generation")
        .eq("client_id", clientId)
        .order("sort_order"),
      supabase.from("social_strategies").select("*").eq("client_id", clientId).order("sort_order"),
      supabase.from("content_ideas").select("id,plan_sequence,title,core_message").eq("monthly_plan_id", planId).order("plan_sequence"),
    ]);
  if (!plan) throw new UserFacingError("Monthly Plan not found.");
  const snapshot = (plan.snapshot ?? {}) as unknown as MonthlyPlanSnapshot;
  // Only accounts this plan can actually use — excluded ones are never
  // offered as a destination, by id or by name.
  const activeSocials = (socials ?? []).filter((s) => !isPlatformExcluded(s));
  // Duane, round 3: an audience can be real and strategic without being
  // offered as a direct generation target for these commercial channels
  // (Daniel's "young people requiring confidence..." stays on his profile,
  // never here) — filtered from live data, not the frozen snapshot, so a
  // later eligibility change takes effect on the next brief.
  const eligibleAudiences = (audiences ?? []).filter((a) => a.eligible_for_generation);

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
  lines.push("Only audiences eligible for generation on this plan are listed — others may exist on the client's strategic profile but must not be targeted here.");
  for (const a of eligibleAudiences) {
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

  return {
    clientName: client?.name ?? "Client",
    plan,
    pillars: pillars ?? [],
    eligibleAudiences: eligibleAudiences.map((a) => ({ id: a.id, name: a.name })),
    activeSocials,
    existingIdeas: existingIdeas ?? [],
    header: lines,
  };
}

function briefSiblingGuidance(): string[] {
  return [
    "## LinkedIn sibling content",
    "One Master Content idea MAY produce Platform Outputs on both LinkedIn accounts where it's genuinely appropriate — this is expected, not something to avoid. But the two adaptations must differ materially, never the same caption twice:",
    "- LinkedIn — Daniel Andrews: personal authority — his own experience, opinion, leadership.",
    "- LinkedIn — CEG: organisational proof — services, outcomes, partnership, professional relevance.",
    "Write each adaptation_note to reflect that distinct angle explicitly, not as a lightly reworded copy of the other.",
    "",
  ];
}

function briefIdLists(ctx: BriefContext): string[] {
  const lines: string[] = [];
  lines.push("Pillar ids available:");
  for (const p of ctx.pillars) lines.push(`- ${p.id} = ${p.name}`);
  lines.push("");
  lines.push("Audience ids available:");
  for (const a of ctx.eligibleAudiences) lines.push(`- ${a.id} = ${a.name}`);
  lines.push("");
  lines.push("Platform ids available (use for lead_platform_id and platform_id — no other platform is valid for this plan):");
  for (const account of ctx.activeSocials) lines.push(`- ${account.id} = ${platformLabel(account)}`);
  lines.push("");
  lines.push("### Allowed formats per platform");
  lines.push("Every format value must be exactly one of the values listed for that platform's id — never freeform, since format drives production Requirements after import.");
  for (const account of ctx.activeSocials) {
    const allowed = allowedFormatsFor(account.platform);
    if (allowed) lines.push(`- ${platformLabel(account)} (id: ${account.id}): ${allowed.join(", ")}`);
  }
  return lines;
}

/** Generate the brief a person pastes into Claude for a whole month —
 * client context, volume target, balance rules, and the exact schema
 * importAiOutput will validate against. Nothing is written; this only reads. */
export async function exportAiBrief(clientId: string, planId: string): Promise<ActionResult<AiBriefResult>> {
  return runAction(async () => {
    const supabase = await createClient();
    const ctx = await buildBriefContext(supabase, clientId, planId);
    const { activeSocials, existingIdeas } = ctx;
    const lines = [...ctx.header];

    // Duane, round 3: an explicit, PBOS-calculated volume target — not
    // hardcoded, not left for the AI to guess — from each active account's
    // real cadence for this month.
    const accountTargets = activeSocials
      .map((account) => ({ account, target: monthlyTarget(account) }))
      .filter((t): t is { account: (typeof activeSocials)[number]; target: number } => t.target !== null);
    const totalOutputTarget = accountTargets.reduce((sum, t) => sum + t.target, 0);
    const ideaMid = Math.round(totalOutputTarget / AVG_OUTPUTS_PER_IDEA);
    lines.push("## Volume target");
    if (accountTargets.length > 0) {
      lines.push(`This plan needs roughly ${totalOutputTarget} Platform Outputs this month, from each active account's own cadence:`);
      for (const { account, target } of accountTargets) lines.push(`- ${platformLabel(account)}: ~${target} (cadence: ${cadenceLabel(account)})`);
      lines.push(
        `Aim for roughly ${Math.max(1, ideaMid - 1)}–${ideaMid + 1} Master Content ideas — one idea often produces more than one Platform Output (see the LinkedIn sibling guidance below), so idea count is naturally lower than the output total.`
      );
    } else {
      lines.push("No active platform has a cadence target set — a volume target can't be calculated. Propose a reasonable number of ideas and PBOS will flag the shortfall after import.");
    }
    lines.push("These are targets, not hard caps — PBOS checks the actual planned-vs-target cadence after you import.");
    lines.push("");

    lines.push("## Pillar balance");
    lines.push(
      "Use all seven approved content pillars where appropriate across the month's ideas — don't cluster on the two or three easiest themes. No more than three Master Content ideas should come from any single pillar this month, unless the month's objective clearly justifies leaning into it."
    );
    lines.push("");

    lines.push(...briefSiblingGuidance());

    lines.push("### Already planned this month — do not duplicate");
    if (existingIdeas.length > 0) {
      for (const idea of existingIdeas) {
        lines.push(`- ${planSequenceLabel(idea.plan_sequence)}: "${idea.title}" — ${idea.core_message || "(no core message set)"}`);
      }
    } else {
      lines.push("(nothing planned yet this month)");
    }
    lines.push("");

    lines.push("## What to return");
    lines.push("Return valid JSON only, matching this exact shape (this is a schema description, not literal values to copy). Do not return a requirements array — PBOS computes Requirements itself after import.");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(OUTPUT_SCHEMA_EXAMPLE, null, 2));
    lines.push("```");
    lines.push("");
    lines.push(...briefIdLists(ctx));

    return { brief: lines.join("\n") };
  });
}

// ---------------------------------------------------------------------------
// Level 2 (Duane): regenerate ONE Master Content item, or ONE Platform
// Output, in place. The record keeps its id, sequence number, publish date,
// media and every other Platform Output — only the words change. Never a
// duplicate. On an approved plan the regeneration lands as a change request
// on that item instead of writing straight through.
// ---------------------------------------------------------------------------

export type RegenerationTarget = { kind: "master"; ideaId: string } | { kind: "output"; ideaId: string; outputId: string };

const ITEM_MASTER_SCHEMA = {
  master_content: {
    title: "string",
    core_message: "string — the single-sentence takeaway",
    purpose: "string",
    pillar_id: "string — one of the pillar ids listed below, or omit to keep the current pillar",
    audience_id: "string — one of the audience ids listed below, or omit to keep the current audience",
    hook: "string — the opening line",
    cta: "string",
    cta_destination:
      "string — an actual destination ONLY if you were given one; otherwise return exactly \"Needs confirmation\" — never construct or guess a URL",
    lead_platform_id: "string — one of the platform ids listed below, or omit to keep the current lead platform",
    lead_draft_copy: "string — the one full draft of publish-ready copy, for the lead platform",
  },
  platform_outputs: [
    {
      platform_id: "string — MUST be one of this item's EXISTING platform ids listed below; each updates that existing output in place",
      format: "string — one of that platform's allowed formats",
      adaptation_note: "string — how this version should differ from the lead draft; not a finished caption",
      media_brief: "string — what media this needs, in words",
      destination_link: "string — optional, only if genuinely different from the Master Content CTA destination",
    },
  ],
};

const ITEM_OUTPUT_SCHEMA = {
  platform_output: {
    format: "string — one of this platform's allowed formats",
    adaptation_note: "string — how this version should differ from the Master Content lead draft; not a finished caption",
    media_brief: "string — what media this needs, in words",
    destination_link: "string — optional, only if genuinely different from the Master Content CTA destination",
  },
};

/** The brief for regenerating one item — same client context and rules as
 * the whole-month brief, plus the item as it stands, every other idea this
 * month (so the replacement doesn't duplicate one), and why it's being
 * redone. */
export async function exportItemBrief(
  clientId: string,
  planId: string,
  target: RegenerationTarget,
  reason: string
): Promise<ActionResult<AiBriefResult>> {
  return runAction(async () => {
    const supabase = await createClient();
    const ctx = await buildBriefContext(supabase, clientId, planId);
    const [{ data: idea }, { data: outputs }] = await Promise.all([
      supabase.from("content_ideas").select("*").eq("id", target.ideaId).eq("monthly_plan_id", planId).maybeSingle(),
      supabase.from("content_outputs").select("*").eq("content_id", target.ideaId).order("sort_order"),
    ]);
    if (!idea) throw new UserFacingError("That Master Content item isn't on this plan.");
    const socialById = new Map(ctx.activeSocials.map((s) => [s.id, s]));
    const pillarName = new Map(ctx.pillars.map((p) => [p.id, p.name]));
    const audienceName = new Map(ctx.eligibleAudiences.map((a) => [a.id, a.name]));
    const seq = planSequenceLabel(idea.plan_sequence);

    const lines = [...ctx.header, ...briefSiblingGuidance()];

    lines.push("### Other Master Content this month — do not duplicate any of these");
    const others = ctx.existingIdeas.filter((i) => i.id !== idea.id);
    if (others.length > 0) {
      for (const other of others) lines.push(`- ${planSequenceLabel(other.plan_sequence)}: "${other.title}" — ${other.core_message || "(no core message set)"}`);
    } else {
      lines.push("(no other Master Content on this plan yet)");
    }
    lines.push("");

    const describeIdea = () => {
      lines.push(`- Title: ${idea.title}`);
      lines.push(`- Core message: ${idea.core_message || "—"}`);
      lines.push(`- Purpose: ${idea.purpose || "—"}`);
      lines.push(`- Pillar: ${idea.pillar_id ? (pillarName.get(idea.pillar_id) ?? "(not an approved pillar)") : "—"}`);
      lines.push(`- Audience: ${idea.audience_id ? (audienceName.get(idea.audience_id) ?? "(not eligible for generation)") : "—"}`);
      lines.push(`- Hook: ${idea.hook || "—"}`);
      lines.push(`- CTA: ${idea.cta || "—"} → ${idea.cta_destination || "—"}`);
      lines.push(`- Lead platform: ${idea.lead_platform_id ? (socialById.get(idea.lead_platform_id) ? platformLabel(socialById.get(idea.lead_platform_id)!) : idea.lead_platform) : "—"}`);
      lines.push(`- Lead draft copy: ${idea.lead_draft_copy || "—"}`);
    };

    if (target.kind === "master") {
      lines.push(`## Regenerate ONE Master Content item: ${seq}`);
      lines.push("This item is being regenerated on its own. The rest of the month stays exactly as it is. Keep its place in the plan — same pillar and audience unless the reason below says otherwise — and write a genuinely better idea, not a rewording of this one.");
      lines.push("");
      lines.push("### The item as it stands");
      describeIdea();
      lines.push("");
      lines.push("### Its existing Platform Outputs (update each in place — do not add or remove platforms)");
      for (const output of outputs ?? []) {
        const account = output.social_account_id ? socialById.get(output.social_account_id) : undefined;
        lines.push(`- ${account ? platformLabel(account) : output.platform} — platform_id: ${output.social_account_id ?? "(none)"}; format: ${output.format || "—"}; adaptation note: ${output.adaptation_note || "—"}`);
      }
      lines.push("");
      lines.push(`### Why it's being regenerated`);
      lines.push(reason.trim() || "(no reason given — treat the current idea as too weak and replace it with a stronger one on the same pillar)");
      lines.push("");
      lines.push("## What to return");
      lines.push("Return valid JSON only, matching this exact shape (schema description, not literal values). platform_outputs may only reference this item's existing platform ids above — one entry per output you want updated; omit an output to leave it untouched.");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(ITEM_MASTER_SCHEMA, null, 2));
      lines.push("```");
    } else {
      const output = (outputs ?? []).find((o) => o.id === target.outputId);
      if (!output) throw new UserFacingError("That Platform Output isn't on this item.");
      const account = output.social_account_id ? socialById.get(output.social_account_id) : undefined;
      const label = account ? platformLabel(account) : output.platform;
      lines.push(`## Regenerate ONE Platform Output: ${seq} on ${label}`);
      lines.push("The Master Content idea is fine — only this one platform adaptation is being redone. Every other output on this item, and the idea itself, stay exactly as they are.");
      lines.push("");
      lines.push("### The Master Content it belongs to (do not change)");
      describeIdea();
      lines.push("");
      lines.push(`### The output as it stands (${label}${account ? `, platform_id: ${account.id}` : ""})`);
      lines.push(`- Format: ${output.format || "—"}`);
      lines.push(`- Adaptation note: ${output.adaptation_note || "—"}`);
      lines.push(`- Media brief: ${output.media_brief || "—"}`);
      lines.push(`- Destination link: ${output.destination_link || "—"}`);
      const siblings = (outputs ?? []).filter((o) => o.id !== output.id && o.social_account_id && normaliseAccountKey(socialById.get(o.social_account_id)?.platform ?? o.platform) === normaliseAccountKey(account?.platform ?? output.platform));
      if (siblings.length > 0) {
        lines.push("");
        lines.push("### Sibling output(s) on the same platform family — this one must differ materially from them");
        for (const sib of siblings) {
          const sibAccount = sib.social_account_id ? socialById.get(sib.social_account_id) : undefined;
          lines.push(`- ${sibAccount ? platformLabel(sibAccount) : sib.platform}: ${sib.adaptation_note || "—"}`);
        }
      }
      lines.push("");
      lines.push(`### Why it's being regenerated`);
      lines.push(reason.trim() || "(no reason given — treat the current adaptation as too weak for this platform and write a stronger one)");
      lines.push("");
      lines.push("## What to return");
      lines.push("Return valid JSON only, matching this exact shape (schema description, not literal values):");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(ITEM_OUTPUT_SCHEMA, null, 2));
      lines.push("```");
    }
    lines.push("");
    lines.push(...briefIdLists(ctx));
    return { brief: lines.join("\n") };
  });
}

export interface ItemRegenerationResult {
  /** True when the plan is approved and the regeneration was recorded as a
   * change request instead of applied. */
  queuedAsChangeRequest: boolean;
  outputsUpdated: number;
  warnings: string[];
}

interface ParsedItemRegeneration {
  master?: Partial<Record<"title" | "core_message" | "purpose" | "pillar_id" | "audience_id" | "hook" | "cta" | "cta_destination" | "lead_platform_id" | "lead_draft_copy", string>>;
  outputs: { outputId: string; format: string; adaptation_note: string; media_brief: string; destination_link: string }[];
}

/** Validate a single-item regeneration against the client's real records —
 * the same checks as the whole-month import — and resolve it onto the
 * EXISTING records. Nothing is written here. */
async function parseItemRegeneration(
  supabase: SupabaseClient,
  clientId: string,
  planId: string,
  target: RegenerationTarget,
  jsonText: string
): Promise<ParsedItemRegeneration> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      jsonText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
    );
  } catch {
    throw new UserFacingError("That isn't valid JSON — paste exactly what Claude returned, nothing else.");
  }
  if (typeof parsed !== "object" || parsed === null) throw new UserFacingError("Expected a JSON object.");
  const body = parsed as { master_content?: unknown; platform_outputs?: unknown; platform_output?: unknown };

  const [{ data: idea }, { data: outputs }, { data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
    supabase.from("content_ideas").select("id").eq("id", target.ideaId).eq("monthly_plan_id", planId).eq("client_id", clientId).maybeSingle(),
    supabase.from("content_outputs").select("id,social_account_id,platform").eq("content_id", target.ideaId),
    supabase.from("brand_pillars").select("id").eq("client_id", clientId),
    supabase.from("audiences").select("id,name,eligible_for_generation").eq("client_id", clientId),
    supabase.from("social_strategies").select("*").eq("client_id", clientId),
  ]);
  if (!idea) throw new UserFacingError("That Master Content item isn't on this plan.");
  const pillarIds = new Set((pillars ?? []).map((p) => p.id));
  const audienceById = new Map((audiences ?? []).map((a) => [a.id, a]));
  const socialById = new Map((socials ?? []).map((s) => [s.id, s]));
  const outputList = outputs ?? [];
  const errors: string[] = [];

  const validateOutputFields = (label: string, raw: RawPlatformOutput, platform: string) => {
    const format = str(raw.format);
    const allowed = allowedFormatsFor(platform);
    if (allowed && !allowed.includes(format)) errors.push(`${label}: format "${format || "(blank)"}" isn't valid here — must be one of ${allowed.join(", ")}.`);
    return { format, adaptation_note: str(raw.adaptation_note), media_brief: str(raw.media_brief), destination_link: str(raw.destination_link) };
  };

  const result: ParsedItemRegeneration = { outputs: [] };

  if (target.kind === "master") {
    const raw = (typeof body.master_content === "object" && body.master_content !== null ? body.master_content : null) as RawMasterContent | null;
    if (!raw) throw new UserFacingError("Expected a master_content object.");
    if (!str(raw.title)) errors.push("master_content: title is required.");
    const pillarId = str(raw.pillar_id);
    if (pillarId && !pillarIds.has(pillarId)) errors.push(`master_content: pillar_id "${pillarId}" doesn't match one of this client's approved pillars.`);
    const audienceId = str(raw.audience_id);
    if (audienceId) {
      const audience = audienceById.get(audienceId);
      if (!audience) errors.push(`master_content: audience_id "${audienceId}" doesn't match one of this client's audiences.`);
      else if (!audience.eligible_for_generation) errors.push(`master_content: audience_id resolves to "${audience.name}", which isn't eligible for generation on this plan.`);
    }
    const leadPlatformId = str(raw.lead_platform_id);
    if (leadPlatformId) {
      const account = socialById.get(leadPlatformId);
      if (!account) errors.push(`master_content: lead_platform_id "${leadPlatformId}" doesn't match a platform on this client's Social tab.`);
      else if (isPlatformExcluded(account)) errors.push(`master_content: lead_platform_id resolves to ${platformLabel(account)}, which is excluded for this plan.`);
    }
    result.master = {
      title: str(raw.title),
      core_message: str(raw.core_message),
      purpose: str(raw.purpose),
      hook: str(raw.hook),
      cta: str(raw.cta),
      cta_destination: normaliseCtaDestination(str(raw.cta_destination)),
      lead_draft_copy: str(raw.lead_draft_copy),
      ...(pillarId ? { pillar_id: pillarId } : {}),
      ...(audienceId ? { audience_id: audienceId } : {}),
      ...(leadPlatformId ? { lead_platform_id: leadPlatformId } : {}),
    };
    const rawOutputs = Array.isArray(body.platform_outputs) ? (body.platform_outputs as RawPlatformOutput[]) : [];
    const seen = new Set<string>();
    rawOutputs.forEach((item, i) => {
      const label = `platform_outputs[${i}]`;
      const platformId = str(item.platform_id);
      const existing = outputList.find((o) => o.social_account_id === platformId);
      if (!platformId || !existing) {
        errors.push(`${label}: platform_id "${platformId || "(blank)"}" isn't one of this item's existing outputs — a regeneration never adds platforms.`);
        return;
      }
      if (seen.has(platformId)) {
        errors.push(`${label}: duplicate entry for the same platform.`);
        return;
      }
      seen.add(platformId);
      const account = socialById.get(platformId);
      result.outputs.push({ outputId: existing.id, ...validateOutputFields(label, item, account?.platform ?? existing.platform) });
    });
  } else {
    const existing = outputList.find((o) => o.id === target.outputId);
    if (!existing) throw new UserFacingError("That Platform Output isn't on this item.");
    const raw = (typeof body.platform_output === "object" && body.platform_output !== null ? body.platform_output : null) as RawPlatformOutput | null;
    if (!raw) throw new UserFacingError("Expected a platform_output object.");
    const account = existing.social_account_id ? socialById.get(existing.social_account_id) : undefined;
    result.outputs.push({ outputId: existing.id, ...validateOutputFields("platform_output", raw, account?.platform ?? existing.platform) });
  }

  if (errors.length > 0) throw new UserFacingError(`Couldn't apply — fix these and try again:\n${errors.join("\n")}`);
  return result;
}

/** Write a parsed regeneration onto the existing records. Shared by the
 * direct path (draft plan) and applyChangeRequest (approved plan). */
async function applyItemRegenerationInternal(
  supabase: SupabaseClient,
  clientId: string,
  planId: string,
  target: RegenerationTarget,
  parsed: ParsedItemRegeneration
): Promise<{ outputsUpdated: number; warnings: string[] }> {
  const warnings: string[] = [];
  if (parsed.master) {
    const patch: Database["public"]["Tables"]["content_ideas"]["Update"] = { ...parsed.master };
    if (parsed.master.lead_platform_id) {
      const { data: account } = await supabase.from("social_strategies").select("platform,account_name").eq("id", parsed.master.lead_platform_id).maybeSingle();
      patch.lead_platform = account ? platformLabel(account) : "";
    }
    const { error } = await supabase.from("content_ideas").update(patch).eq("id", target.ideaId).eq("monthly_plan_id", planId);
    if (error) throw new Error(error.message);
  }
  let outputsUpdated = 0;
  for (const output of parsed.outputs) {
    const { error } = await supabase
      .from("content_outputs")
      .update({ format: output.format, adaptation_note: output.adaptation_note, media_brief: output.media_brief, destination_link: output.destination_link })
      .eq("id", output.outputId)
      .eq("content_id", target.ideaId);
    if (error) throw new Error(error.message);
    outputsUpdated += 1;
  }
  // Production requirements follow the content — best effort, as on import.
  try {
    await reconcilePlanRequirementsInternal(supabase, clientId, planId);
  } catch (reconcileError) {
    warnings.push(`Couldn't recompute requirements: ${reconcileError instanceof Error ? reconcileError.message : String(reconcileError)}`);
  }
  return { outputsUpdated, warnings };
}

/** Apply (or, on an approved plan, queue) a single-item regeneration. */
export async function importItemRegeneration(
  clientId: string,
  planId: string,
  target: RegenerationTarget,
  jsonText: string,
  reason: string
): Promise<ActionResult<ItemRegenerationResult>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: plan } = await supabase.from("monthly_plans").select("status").eq("id", planId).eq("client_id", clientId).maybeSingle();
    if (!plan) throw new UserFacingError("Monthly Plan not found.");
    const parsed = await parseItemRegeneration(supabase, clientId, planId, target, jsonText);

    if (isPlanLocked(plan.status)) {
      if (plan.status === "closed") throw new UserFacingError("This Monthly Plan is closed — reopen it before requesting changes.");
      const { error } = await supabase.from("master_content_change_requests").insert({
        client_id: clientId,
        monthly_plan_id: planId,
        content_id: target.ideaId,
        kind: "regeneration",
        field: target.kind === "master" ? "master_content" : "platform_output",
        proposed_value: JSON.stringify({ target, parsed }),
        reason: reason.trim(),
        requested_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      revalidatePlan(clientId, planId);
      return { queuedAsChangeRequest: true, outputsUpdated: 0, warnings: [] };
    }

    const applied = await applyItemRegenerationInternal(supabase, clientId, planId, target, parsed);
    revalidatePlan(clientId, planId);
    return { queuedAsChangeRequest: false, ...applied };
  });
}

// ---------------------------------------------------------------------------
// Change requests on an approved plan (Duane): one item, one change, reviewed
// then applied — the approved version stays exactly as approved until then.
// ---------------------------------------------------------------------------

export async function requestPlanContentChange(
  clientId: string,
  planId: string,
  ideaId: string,
  field: string,
  proposedValue: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  if (!CHANGE_REQUEST_FIELDS.some((f) => f.value === field)) return { ok: false, message: "That field can't be changed through a change request." };
  if (field === "title" && !proposedValue.trim()) return { ok: false, message: "Title can't be empty." };
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: idea } = await supabase.from("content_ideas").select("*").eq("id", ideaId).eq("monthly_plan_id", planId).eq("client_id", clientId).maybeSingle();
    if (!idea) throw new UserFacingError("That Master Content item isn't on this plan.");
    const previous = String((idea as Record<string, unknown>)[field] ?? "");
    const { data, error } = await supabase
      .from("master_content_change_requests")
      .insert({
        client_id: clientId,
        monthly_plan_id: planId,
        content_id: ideaId,
        kind: "field",
        field,
        previous_value: previous,
        proposed_value: proposedValue,
        reason: reason.trim(),
        requested_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, planId);
    return { id: data.id };
  });
}

export async function applyChangeRequest(clientId: string, requestId: string, note = ""): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: request } = await supabase.from("master_content_change_requests").select("*").eq("id", requestId).eq("client_id", clientId).maybeSingle();
    if (!request) throw new UserFacingError("Change request not found.");
    if (request.state !== "open") throw new UserFacingError("This change request has already been resolved.");

    if (request.kind === "field") {
      if (!CHANGE_REQUEST_FIELDS.some((f) => f.value === request.field)) throw new UserFacingError("Unknown field on this change request.");
      const { error } = await supabase
        .from("content_ideas")
        .update(fieldPatch<Database["public"]["Tables"]["content_ideas"]["Update"]>(request.field as PlanContentField, request.proposed_value))
        .eq("id", request.content_id);
      if (error) throw new Error(error.message);
    } else {
      const payload = JSON.parse(request.proposed_value) as { target: RegenerationTarget; parsed: ParsedItemRegeneration };
      await applyItemRegenerationInternal(supabase, clientId, request.monthly_plan_id, payload.target, payload.parsed);
    }

    const { error } = await supabase
      .from("master_content_change_requests")
      .update({ state: "applied", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString(), resolution_note: note.trim() })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, request.monthly_plan_id);
    return undefined;
  });
}

export async function declineChangeRequest(clientId: string, requestId: string, note = ""): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: request } = await supabase.from("master_content_change_requests").select("id,state,monthly_plan_id").eq("id", requestId).eq("client_id", clientId).maybeSingle();
    if (!request) throw new UserFacingError("Change request not found.");
    if (request.state !== "open") throw new UserFacingError("This change request has already been resolved.");
    const { error } = await supabase
      .from("master_content_change_requests")
      .update({ state: "declined", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString(), resolution_note: note.trim() })
      .eq("id", requestId);
    if (error) throw new Error(error.message);
    revalidatePlan(clientId, request.monthly_plan_id);
    return undefined;
  });
}

export interface ImportAiOutputResult {
  mode: ImportMode;
  /** Draft AI-imported Master Content removed by a "replace" import. */
  replaced: number;
  /** Master Content on this plan left untouched (hand-added, approved,
   * scheduled or published). */
  kept: number;
  /** The revision number the previous plan state was saved as, when an
   * approved/active plan was replaced. */
  revisionCreated: number | null;
  masterContentCreated: number;
  platformOutputsCreated: number;
  /** Production requirements PBOS computed from the plan's actual Master
   * Content / Platform Outputs — aggregate format counts, a missing lead
   * platform output, a missing CTA destination, an excluded or off-cadence
   * platform, a pillar-balance flag. Requirements are never part of what
   * the AI returns (Duane, round 3) — this is the only source. See
   * reconcilePlanRequirements. */
  requirementsAutoGenerated: number;
  /** Platform Outputs PBOS assigned a publish date to from cadence. */
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

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Validate and populate a Monthly Plan from Claude's pasted JSON. PBOS owns
 * every row this creates — nothing here is a live AI connection; the JSON is
 * validated exactly as strictly as a person's own input would be, pillar,
 * audience and platform ids are resolved against this client's real records
 * (never created to fit, and a mismatch fails the whole import rather than
 * silently dropping or guessing), and platform_outputs are linked back to
 * the master_content item they belong to by position in the same JSON, not
 * by guessing. Requirements are never accepted from the AI (Duane, round
 * 3) — reconcilePlanRequirementsInternal computes them from what was
 * actually imported, after publish dates are assigned.
 */
export async function importAiOutput(
  clientId: string,
  planId: string,
  jsonText: string,
  mode: ImportMode = "add"
): Promise<ActionResult<ImportAiOutputResult>> {
  if (mode !== "replace" && mode !== "add") return { ok: false, message: "Unknown import mode." };
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
    return { ok: false, message: "Expected a JSON object with master_content / platform_outputs." };
  }

  const body = parsed as { master_content?: unknown; platform_outputs?: unknown };
  const masterRaw = Array.isArray(body.master_content) ? (body.master_content as RawMasterContent[]) : [];
  const outputsRaw = Array.isArray(body.platform_outputs) ? (body.platform_outputs as RawPlatformOutput[]) : [];

  if (masterRaw.length === 0 && outputsRaw.length === 0) {
    return { ok: false, message: "Nothing to import — the JSON has no master_content or platform_outputs." };
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
  if (shapeErrors.length > 0) {
    return { ok: false, message: `Couldn't import — fix these and try again:\n${shapeErrors.join("\n")}` };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: plan } = await supabase.from("monthly_plans").select("id,status,revision").eq("id", planId).eq("client_id", clientId).maybeSingle();
    if (!plan) throw new UserFacingError("Monthly Plan not found.");
    const planStatus = plan.status as MonthlyPlanStatus;
    if (planStatus === "closed") throw new UserFacingError("This Monthly Plan is closed — set it back to Planning or In review before importing.");
    const existing = await classifyPlanContent(supabase, planId);
    const kept = existing.locked + existing.manual;

    const [{ data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
      supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
      supabase.from("audiences").select("id,name,eligible_for_generation").eq("client_id", clientId),
      supabase.from("social_strategies").select("*").eq("client_id", clientId),
    ]);
    const pillarIds = new Set((pillars ?? []).map((p) => p.id));
    const audienceById = new Map((audiences ?? []).map((a) => [a.id, a]));
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
      if (audienceId) {
        const audience = audienceById.get(audienceId);
        if (!audience) idErrors.push(`${label}: audience_id "${audienceId}" doesn't match one of this client's audiences.`);
        else if (!audience.eligible_for_generation)
          idErrors.push(`${label}: audience_id resolves to "${audience.name}", which isn't eligible for generation on this plan.`);
      }
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
      const format = str(item.format);
      const allowedFormats = allowedFormatsFor(account.platform);
      if (allowedFormats && !allowedFormats.includes(format)) {
        idErrors.push(`${label}: format "${format || "(blank)"}" isn't valid for ${platformLabel(account)} — must be one of ${allowedFormats.join(", ")}.`);
      }
    });
    if (idErrors.length > 0) {
      throw new UserFacingError(`Couldn't import — fix these and try again:\n${idErrors.join("\n")}`);
    }

    const warnings: string[] = [];

    // Duane, round 3: a Master Content idea may legitimately produce
    // outputs on both LinkedIn accounts, but the two adaptations must
    // differ materially — warn (don't block) if two sibling outputs under
    // the same idea, on the same platform family, carry identical
    // adaptation_note text.
    const siblingGroups = new Map<string, number[]>();
    outputsRaw.forEach((item, i) => {
      const account = socialById.get(str(item.platform_id));
      if (!account) return;
      const key = `${item.master_index}:${normaliseAccountKey(account.platform)}`;
      const list = siblingGroups.get(key) ?? [];
      list.push(i);
      siblingGroups.set(key, list);
    });
    for (const indices of siblingGroups.values()) {
      if (indices.length < 2) continue;
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const noteA = str(outputsRaw[indices[a]!]!.adaptation_note).toLowerCase();
          const noteB = str(outputsRaw[indices[b]!]!.adaptation_note).toLowerCase();
          if (noteA && noteA === noteB) {
            warnings.push(
              `platform_outputs[${indices[a]}] and [${indices[b]}] (same Master Content item, same platform family) have identical adaptation_note text — siblings must differ materially.`
            );
          }
        }
      }
    }
    // Scope the import (validation above has passed — nothing is removed for
    // an import that would then be rejected).
    let replaced = 0;
    let revisionCreated: number | null = null;
    if (mode === "replace" && existing.replaceableIds.length > 0) {
      if (REVISION_STATUSES.includes(planStatus)) {
        // Never silently replace an approved plan: keep what was approved as
        // a numbered revision, then move the plan back into review.
        const doc = await buildPlanExportInternal(supabase, clientId, planId);
        const { error: revisionError } = await supabase.from("monthly_plan_revisions").insert({
          monthly_plan_id: planId,
          client_id: clientId,
          revision: plan.revision,
          status_at_snapshot: planStatus,
          snapshot: doc as unknown as Database["public"]["Tables"]["monthly_plan_revisions"]["Insert"]["snapshot"],
          note: `Superseded by a new AI import (${existing.replaceableIds.length} draft item(s) replaced).`,
          created_by: user?.id ?? null,
        });
        if (revisionError) throw new Error(revisionError.message);
        const { error: bumpError } = await supabase
          .from("monthly_plans")
          .update({ revision: plan.revision + 1, status: "in_review" })
          .eq("id", planId);
        if (bumpError) throw new Error(bumpError.message);
        revisionCreated = plan.revision;
      }
      const { error: removeError } = await supabase.from("content_ideas").delete().in("id", existing.replaceableIds);
      if (removeError) throw new Error(removeError.message);
      replaced = existing.replaceableIds.length;
    }

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
            // "Needs confirmation" is kept as written (canonical spelling) —
            // it's a real state, distinct from a blank (Duane, first full run).
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

      // PBOS assigns dates from cadence — best-effort: a hiccup here
      // shouldn't undo an otherwise good import.
      let datesAssigned = 0;
      try {
        const dated = await assignPlanPublishDatesInternal(supabase, clientId, planId);
        datesAssigned = dated.assigned;
        if (dated.unspacedSiblingGroups > 0) {
          warnings.push(`${dated.unspacedSiblingGroups} sibling group(s) could not be fully spaced within this planning period.`);
        }
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
        mode,
        replaced,
        kept,
        revisionCreated,
        masterContentCreated: masterIds.length,
        platformOutputsCreated: outputsCreated,
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
  revision: number;
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
    /** confirmed | needs_confirmation | missing | no_cta — "Needs
     * confirmation" is a state the AI set deliberately, not missing data. */
    cta_destination_state: CtaDestinationState;
    lead_platform: string;
    lead_platform_id: string | null;
    lead_draft_copy: string;
    target_publish_date: string | null;
    status: string;
    origin: string;
    platform_outputs: {
      /** Platform family only ("LinkedIn"); the account below is what
       * routing, cadence and the calendar key on. */
      platform: string;
      /** The specific social account / platform profile this publishes to —
       * so LinkedIn — Daniel Andrews and LinkedIn — CEG stay distinct. */
      social_account_id: string | null;
      account_label: string;
      format: string;
      caption: string;
      adaptation_note: string;
      destination_link: string;
      media_brief: string;
      media_state: string;
      target_publish_date: string | null;
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

async function buildPlanExportInternal(supabase: SupabaseClient, clientId: string, planId: string): Promise<MonthlyPlanExport> {
  {
    const [{ data: client }, { data: plan }, { data: pillars }, { data: audiences }, { data: ideas }, { data: requirements }, { data: socials }] =
      await Promise.all([
        supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle(),
        supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", clientId).maybeSingle(),
        supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
        supabase.from("audiences").select("id,name").eq("client_id", clientId),
        supabase.from("content_ideas").select("*").eq("monthly_plan_id", planId).order("plan_sequence"),
        supabase.from("monthly_plan_requirements").select("*").eq("monthly_plan_id", planId).order("created_at"),
        supabase.from("social_strategies").select("id,platform,account_name").eq("client_id", clientId),
      ]);
    if (!client || !plan) throw new UserFacingError("Monthly Plan not found.");
    const socialById = new Map((socials ?? []).map((s) => [s.id, s]));

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
      revision: plan.revision,
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
        cta_destination_state: ctaDestinationState(idea),
        lead_platform: idea.lead_platform,
        lead_platform_id: idea.lead_platform_id,
        lead_draft_copy: idea.lead_draft_copy,
        target_publish_date: idea.target_publish_date,
        status: idea.status,
        origin: idea.origin,
        platform_outputs: (outputsByIdea.get(idea.id) ?? []).map((output) => {
          const account = output.social_account_id ? socialById.get(output.social_account_id) : undefined;
          return {
            platform: output.platform,
            social_account_id: account?.id ?? null,
            account_label: account ? platformLabel(account) : output.platform,
            format: output.format,
          caption: output.caption,
          adaptation_note: output.adaptation_note,
          destination_link: output.destination_link,
          media_brief: output.media_brief,
            media_state: output.media_state,
            target_publish_date: output.target_publish_date,
            status: output.status,
            origin: output.origin,
          };
        }),
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

    return doc;
  }
}

export async function exportMonthlyPlanJson(clientId: string, planId: string): Promise<ActionResult<{ json: string }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const doc = await buildPlanExportInternal(supabase, clientId, planId);
    return { json: JSON.stringify(doc, null, 2) };
  });
}
