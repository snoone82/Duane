"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { fieldPatch } from "@/lib/field-patch";
import { buildRecordMatcher, type RecordMatcher } from "@/lib/import/record-match";
import type { Database } from "@/lib/database.types";
import {
  MONTHLY_PLAN_STATUS,
  REQUIREMENT_TYPE,
  REQUIREMENT_STATE,
  type MonthlyPlanStatus,
  type RequirementType,
} from "@/lib/status";
import { periodMonthLabel, planSequenceLabel } from "@/lib/monthly-plan-format";

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
    const [{ data: client }, snapshot] = await Promise.all([
      supabase.from("clients").select("north_star").eq("id", clientId).maybeSingle(),
      buildSnapshot(supabase, clientId),
    ]);

    const { data, error } = await supabase
      .from("monthly_plans")
      .insert({
        client_id: clientId,
        period_month: normalised,
        // A best-effort starting point, not a rule — a strategist edits this
        // fresh each month; it is never re-pulled automatically afterwards.
        primary_objective: client?.north_star ?? "",
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

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const sequence = await nextPlanSequence(supabase, planId);
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
      lead_platform: String(formData.get("lead_platform") ?? "").trim(),
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
  "lead_platform",
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
// AI export / import (Duane, 5 Sep 2026). No Claude API call here — PBOS
// generates a brief, a person pastes it into Claude by hand, and pastes the
// JSON that comes back into importAiOutput. Claude does not own the data:
// this only ever proposes rows for PBOS to create, exactly as if a person
// had typed them in — never a live connection, and nothing is trusted
// without going through the same validation a person's input would.
// ---------------------------------------------------------------------------

export interface AiBriefResult {
  brief: string;
}

/** The exact JSON shape importAiOutput expects, embedded in the brief so
 * Claude sees it verbatim rather than a paraphrase of it. */
const OUTPUT_SCHEMA_EXAMPLE = {
  master_content: [
    {
      title: "string — the piece's working title",
      core_message: "string — the single-sentence takeaway",
      purpose: "string — why this piece exists",
      pillar: "string — must exactly match one of the pillar names listed below, or leave blank",
      audience: "string — must exactly match one of the audience names listed below, or leave blank",
      hook: "string — the opening line",
      cta: "string",
      cta_destination: "string",
      lead_platform: "string — should match one of the platforms listed below",
      lead_draft_copy: "string — a fuller first draft of publish-ready copy for the lead platform",
    },
  ],
  platform_outputs: [
    {
      master_index: "number — 1-based position in master_content above that this output belongs to",
      platform: "string — should match one of the platforms listed below",
      format: "string",
      caption: "string",
      cta: "string",
      hashtags: "string",
      media_brief: "string — what media this needs, described in words, before anyone sources or uploads it",
      destination_link: "string — optional",
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

/** Generate the brief a person pastes into Claude — client context from the
 * Client Snapshot, plus the exact schema importAiOutput will validate
 * against. Nothing is written; this only reads. */
export async function exportAiBrief(clientId: string, planId: string): Promise<ActionResult<AiBriefResult>> {
  return runAction(async () => {
    const supabase = await createClient();
    const [{ data: client }, { data: plan }, { data: pillars }, { data: audiences }, { data: existingIdeas }] = await Promise.all([
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
      supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", clientId).maybeSingle(),
      supabase.from("brand_pillars").select("name").eq("client_id", clientId).order("sort_order"),
      supabase.from("audiences").select("name").eq("client_id", clientId).order("sort_order"),
      supabase.from("content_ideas").select("plan_sequence,title").eq("monthly_plan_id", planId).order("plan_sequence"),
    ]);
    if (!plan) throw new UserFacingError("Monthly Plan not found.");
    const snapshot = (plan.snapshot ?? {}) as unknown as MonthlyPlanSnapshot;

    const lines: string[] = [];
    lines.push(`# ${client?.name ?? "Client"} — ${periodMonthLabel(plan.period_month)} Monthly Plan: AI Content Brief`);
    lines.push("");
    lines.push(
      "You are proposing structured content for this client's Monthly Plan inside PBOS (Personal Brand Operating System). PBOS owns the client record and this plan — you are only being asked to generate proposed structured content for a person to review and import into it. Return ONLY the JSON described at the end of this brief: no commentary, no markdown code fences, nothing before or after it."
    );
    lines.push("");
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
    lines.push("### Platform cadence & rules");
    for (const pl of snapshot.platforms ?? []) {
      const label = pl.account_name ? `${pl.platform} — ${pl.account_name}` : pl.platform;
      const cadence = pl.cadence_target ? `${pl.cadence_target}/${pl.cadence_period ?? "period"}` : "—";
      lines.push(`- **${label}** — objective: ${pl.objective || "—"}; cadence: ${cadence}; tone: ${pl.tone_voice || "—"}; CTA: ${pl.cta_strategy || "—"}`);
    }
    lines.push("");

    if ((existingIdeas ?? []).length > 0) {
      lines.push("### Already planned this month (do not duplicate)");
      for (const idea of existingIdeas ?? []) lines.push(`- ${planSequenceLabel(idea.plan_sequence)}: ${idea.title}`);
      lines.push("");
    }

    lines.push("## What to return");
    lines.push("Return valid JSON only, matching this exact shape (this is a schema description, not literal values to copy):");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(OUTPUT_SCHEMA_EXAMPLE, null, 2));
    lines.push("```");
    lines.push("");
    lines.push(`Pillar names available (use exactly): ${(pillars ?? []).map((p) => p.name).join(", ") || "(none set up yet)"}`);
    lines.push(`Audience names available (use exactly): ${(audiences ?? []).map((a) => a.name).join(", ") || "(none set up yet)"}`);

    return { brief: lines.join("\n") };
  });
}

export interface ImportAiOutputResult {
  masterContentCreated: number;
  platformOutputsCreated: number;
  requirementsCreated: number;
  warnings: string[];
}

interface RawMasterContent {
  title?: unknown;
  core_message?: unknown;
  purpose?: unknown;
  pillar?: unknown;
  audience?: unknown;
  hook?: unknown;
  cta?: unknown;
  cta_destination?: unknown;
  lead_platform?: unknown;
  lead_draft_copy?: unknown;
}
interface RawPlatformOutput {
  master_index?: unknown;
  platform?: unknown;
  format?: unknown;
  caption?: unknown;
  cta?: unknown;
  hashtags?: unknown;
  media_brief?: unknown;
  destination_link?: unknown;
}
interface RawRequirement {
  type?: unknown;
  description?: unknown;
  owner_note?: unknown;
  due_date?: unknown;
  related_content_note?: unknown;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function resolveName(matcher: RecordMatcher<{ id: string; name: string }>, name: string): string | null {
  if (!name) return null;
  const outcome = matcher.match({ name });
  return outcome.kind === "exact" || outcome.kind === "normalised" || outcome.kind === "id" ? outcome.record.id : null;
}

/**
 * Validate and populate a Monthly Plan from Claude's pasted JSON. PBOS owns
 * every row this creates — nothing here is a live AI connection; the JSON is
 * validated exactly as strictly as a person's own input would be, pillar and
 * audience names are resolved against this client's real records (never
 * created to fit), and platform_outputs are linked back to the
 * master_content item they belong to by position in the same JSON, not by
 * guessing.
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

  const errors: string[] = [];
  masterRaw.forEach((item, i) => {
    if (!str(item.title)) errors.push(`master_content[${i}]: title is required.`);
  });
  outputsRaw.forEach((item, i) => {
    const idx = item.master_index;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 1 || idx > masterRaw.length) {
      errors.push(`platform_outputs[${i}]: master_index must be a whole number from 1 to ${masterRaw.length || "?"}, pointing at a master_content item.`);
    }
    if (!str(item.platform)) errors.push(`platform_outputs[${i}]: platform is required.`);
  });
  requirementsRaw.forEach((item, i) => {
    const type = str(item.type) || "other";
    if (!REQUIREMENT_TYPE.some((t) => t.value === type)) {
      errors.push(`requirements[${i}]: type "${str(item.type)}" isn't one of ${REQUIREMENT_TYPE.map((t) => t.value).join(", ")}.`);
    }
    if (!str(item.description)) errors.push(`requirements[${i}]: description is required.`);
  });
  if (errors.length > 0) {
    return { ok: false, message: `Couldn't import — fix these and try again:\n${errors.join("\n")}` };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: plan } = await supabase.from("monthly_plans").select("id").eq("id", planId).eq("client_id", clientId).maybeSingle();
    if (!plan) throw new UserFacingError("Monthly Plan not found.");

    const [{ data: pillars }, { data: audiences }] = await Promise.all([
      supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
      supabase.from("audiences").select("id,name").eq("client_id", clientId),
    ]);
    const pillarMatcher = buildRecordMatcher((pillars ?? []).map((p) => ({ id: p.id, name: p.name })));
    const audienceMatcher = buildRecordMatcher((audiences ?? []).map((a) => ({ id: a.id, name: a.name })));

    const warnings: string[] = [];
    let sequence = await nextPlanSequence(supabase, planId);
    const masterIds: string[] = [];

    try {
      for (const item of masterRaw) {
        const pillarName = str(item.pillar);
        const pillarId = resolveName(pillarMatcher, pillarName);
        if (pillarName && !pillarId) warnings.push(`"${str(item.title)}": pillar "${pillarName}" not recognised — left unassigned.`);
        const audienceName = str(item.audience);
        const audienceId = resolveName(audienceMatcher, audienceName);
        if (audienceName && !audienceId) warnings.push(`"${str(item.title)}": audience "${audienceName}" not recognised — left unassigned.`);

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
            cta_destination: str(item.cta_destination),
            lead_platform: str(item.lead_platform),
            lead_draft_copy: str(item.lead_draft_copy),
            pillar_id: pillarId,
            audience_id: audienceId,
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
        const { error } = await supabase.from("content_outputs").insert({
          content_id: contentId,
          client_id: clientId,
          platform: str(item.platform),
          format: str(item.format),
          caption: str(item.caption),
          cta: str(item.cta),
          hashtags: str(item.hashtags),
          media_brief: str(item.media_brief),
          destination_link: str(item.destination_link),
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
        });
        if (error) throw new Error(`Requirement "${str(item.description)}": ${error.message}`);
        requirementsCreated += 1;
      }

      revalidatePlan(clientId, planId);
      return {
        masterContentCreated: masterIds.length,
        platformOutputsCreated: outputsCreated,
        requirementsCreated,
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
