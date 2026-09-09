"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import { PBOS_STAGES, PBOS_TIERS, PBOS_LEAD_STATUS, ENGAGEMENT_STATUS, type PbosStage } from "@/lib/status";
import type { Database } from "@/lib/database.types";

/** PBOS's own sales — Duane growing PBOS as a business. Nothing in this file
 * reads or writes a client's own commercial data; the two are separate
 * systems now and the only bridge between them is the Won conversion at the
 * bottom, which runs once, in one direction. */

function revalidatePbos() {
  revalidatePath("/sales");
  revalidatePath("/");
}

const isStage = (value: string): value is PbosStage => PBOS_STAGES.some((s) => s.value === value);
const isTier = (value: string) => PBOS_TIERS.some((t) => t.value === value);

/** Numbers arrive from forms as strings and are all optional — the tiers ship
 * before the pricing does, so "" must mean "not set yet", never 0. */
function parseMoney(raw: FormDataEntryValue | null | string): number | null | "invalid" {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isNaN(value) || value < 0 ? "invalid" : value;
}

// ---------------------------------------------------------------------------
// Leads — people who might buy PBOS. Not clients. No client record exists for
// them and none is created until a deal is won.
// ---------------------------------------------------------------------------

export async function createLead(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the lead a name." };
  const tierInterest = String(formData.get("tier_interest") ?? "").trim();
  if (tierInterest && !isTier(tierInterest)) return { ok: false, message: "Unknown tier." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerRaw = String(formData.get("owner") ?? "").trim();

    const { error } = await supabase.from("pbos_leads").insert({
      name,
      company: String(formData.get("company") ?? "").trim(),
      job_title: String(formData.get("job_title") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      linkedin_url: String(formData.get("linkedin_url") ?? "").trim(),
      website_url: String(formData.get("website_url") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      tier_interest: tierInterest || null,
      notes: String(formData.get("notes") ?? "").trim(),
      owner_user_id: ownerRaw.startsWith("u:") ? ownerRaw.slice(2) : (user?.id ?? null),
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

const LEAD_FIELDS = [
  "name",
  "company",
  "job_title",
  "email",
  "phone",
  "linkedin_url",
  "website_url",
  "source",
  "notes",
  "tier_interest",
] as const;
type LeadField = (typeof LEAD_FIELDS)[number];

export async function updateLeadField(leadId: string, field: LeadField, value: string): Promise<ActionResult> {
  if (!LEAD_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "name" && !value.trim()) return { ok: false, message: "The lead needs a name." };

  let patchValue: string | null = value.trim();
  if (field === "tier_interest") {
    if (patchValue && !isTier(patchValue)) return { ok: false, message: "Unknown tier." };
    patchValue = patchValue || null;
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("pbos_leads")
      .update(fieldPatch<Database["public"]["Tables"]["pbos_leads"]["Update"]>(field, patchValue))
      .eq("id", leadId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

/** Open / lost / dormant only. 'won' is not settable by hand — winning is
 * something a deal does, and it has to create the client record to be true
 * (see setOpportunityStage). */
export async function setLeadStatus(leadId: string, status: string): Promise<ActionResult> {
  if (status === "won") {
    return { ok: false, message: "Mark the opportunity Won — that's what creates the client record." };
  }
  if (!PBOS_LEAD_STATUS.some((s) => s.value === status)) return { ok: false, message: "Unknown status." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("pbos_leads").update({ status }).eq("id", leadId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: lead, error: readError } = await supabase
      .from("pbos_leads")
      .select("converted_client_id")
      .eq("id", leadId)
      .single();
    if (readError) throw new Error(readError.message);
    if (lead.converted_client_id) {
      throw new Error("This lead became a client — delete the client record instead if that's really what you want.");
    }
    const { error } = await supabase.from("pbos_leads").delete().eq("id", leadId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Opportunities — the deal: which tier, on what terms.
// ---------------------------------------------------------------------------

export async function createOpportunity(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const tier = String(formData.get("tier") ?? "").trim();
  if (!leadId) return { ok: false, message: "Pick the lead this deal belongs to." };
  if (!title) return { ok: false, message: "Name the deal — usually the tier plus what's included." };
  if (!isTier(tier)) return { ok: false, message: "Pick which PBOS tier is being sold." };

  const setupFee = parseMoney(formData.get("setup_fee"));
  const monthlyFee = parseMoney(formData.get("monthly_fee"));
  const extrasValue = parseMoney(formData.get("extras_monthly_value"));
  if (setupFee === "invalid" || monthlyFee === "invalid" || extrasValue === "invalid") {
    return { ok: false, message: "Fees must be plain positive numbers — or left blank until they're agreed." };
  }

  const probabilityRaw = Number(String(formData.get("probability") ?? "50"));
  const probability = Number.isNaN(probabilityRaw) ? 50 : Math.max(0, Math.min(100, Math.round(probabilityRaw)));
  const termRaw = String(formData.get("contract_term_months") ?? "").trim();
  const term = termRaw ? Number(termRaw) : null;
  if (term !== null && (Number.isNaN(term) || term <= 0)) return { ok: false, message: "Contract term must be a number of months." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerRaw = String(formData.get("owner") ?? "").trim();

    const { error } = await supabase.from("pbos_opportunities").insert({
      lead_id: leadId,
      title,
      tier,
      contact_name: String(formData.get("contact_name") ?? "").trim(),
      setup_fee: setupFee,
      monthly_fee: monthlyFee,
      extras: String(formData.get("extras") ?? "").trim(),
      extras_monthly_value: extrasValue,
      contract_start_date: String(formData.get("contract_start_date") ?? "").trim() || null,
      contract_term_months: term,
      probability,
      expected_close: String(formData.get("expected_close") ?? "").trim() || null,
      source: String(formData.get("source") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      owner_user_id: ownerRaw.startsWith("u:") ? ownerRaw.slice(2) : (user?.id ?? null),
      stage_history: [{ stage: "lead", at: new Date().toISOString() }],
    });
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

const OPPORTUNITY_FIELDS = [
  "title",
  "tier",
  "contact_name",
  "source",
  "notes",
  "extras",
  "lost_reason",
  "setup_fee",
  "monthly_fee",
  "extras_monthly_value",
  "contract_start_date",
  "contract_term_months",
  "expected_close",
  "probability",
] as const;
type OpportunityField = (typeof OPPORTUNITY_FIELDS)[number];

const MONEY_FIELDS: OpportunityField[] = ["setup_fee", "monthly_fee", "extras_monthly_value"];

export async function updateOpportunityField(
  opportunityId: string,
  field: OpportunityField,
  value: string,
): Promise<ActionResult> {
  if (!OPPORTUNITY_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "The deal name can't be empty." };

  let patchValue: string | number | null = value.trim();
  if (MONEY_FIELDS.includes(field)) {
    const parsed = parseMoney(value);
    if (parsed === "invalid") return { ok: false, message: "That needs to be a plain positive number, or blank." };
    patchValue = parsed;
  }
  if (field === "tier" && !isTier(String(patchValue))) return { ok: false, message: "Unknown tier." };
  if (field === "probability") {
    const n = Number(value);
    if (Number.isNaN(n)) return { ok: false, message: "Probability must be a number." };
    patchValue = Math.max(0, Math.min(100, Math.round(n)));
  }
  if (field === "contract_term_months") {
    const trimmed = value.trim();
    const n = trimmed ? Number(trimmed) : null;
    if (n !== null && (Number.isNaN(n) || n <= 0)) return { ok: false, message: "Contract term must be a number of months." };
    patchValue = n;
  }
  if (field === "contract_start_date" || field === "expected_close") patchValue = value.trim() || null;

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("pbos_opportunities")
      .update(fieldPatch<Database["public"]["Tables"]["pbos_opportunities"]["Update"]>(field, patchValue))
      .eq("id", opportunityId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

export async function deleteOpportunity(opportunityId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("pbos_opportunities").delete().eq("id", opportunityId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Stage changes — including the one that turns a lead into a client.
// ---------------------------------------------------------------------------

/** Move a deal along the journey. Won is the moment the client record is
 * created: name, company, tier and the agreed commercial terms all carry
 * across so nothing is retyped, and the client lands on 'onboarding' — won,
 * but deliberately not delivering yet. Onboarding is something Duane starts
 * from there, not something winning the deal did for him. */
export async function setOpportunityStage(opportunityId: string, stage: string): Promise<ActionResult<string | undefined>> {
  if (!isStage(stage)) return { ok: false, message: "Unknown stage." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: opportunity, error: readError } = await supabase
      .from("pbos_opportunities")
      .select("*, lead:pbos_leads(*)")
      .eq("id", opportunityId)
      .single();
    if (readError) throw new Error(readError.message);
    if (opportunity.stage === stage) return undefined;

    const lead = opportunity.lead;
    if (!lead) throw new Error("This deal has no lead attached — it can't be moved.");
    if (opportunity.stage === "won") {
      throw new Error(`${lead.name} is already a client. Change their engagement on the client record instead.`);
    }

    const history = Array.isArray(opportunity.stage_history) ? opportunity.stage_history : [];
    const terminal = stage === "won" || stage === "lost";
    const { error: stageError } = await supabase
      .from("pbos_opportunities")
      .update({
        stage,
        stage_history: [...history, { stage, at: new Date().toISOString() }],
        closed_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", opportunityId);
    if (stageError) throw new Error(stageError.message);

    if (stage === "lost") {
      // Only close the lead if this was their last live deal — a lead can be
      // in conversation about two tiers at once.
      const { count } = await supabase
        .from("pbos_opportunities")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .not("stage", "in", "(won,lost)");
      if (!count && lead.status === "open") {
        await supabase.from("pbos_leads").update({ status: "lost" }).eq("id", lead.id);
      }
      revalidatePbos();
      return undefined;
    }

    if (stage !== "won") {
      revalidatePbos();
      return undefined;
    }

    // --- Won: create the client, exactly once. ---
    if (lead.converted_client_id) {
      revalidatePbos();
      return "Lead already has a client record — reusing it.";
    }

    const tierName = PBOS_TIERS.find((t) => t.value === opportunity.tier)?.label ?? opportunity.tier;
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: lead.name,
        company: lead.company || null,
        job_title: lead.job_title || null,
        email: lead.email || null,
        phone: lead.phone || null,
        website_url: lead.website_url || null,
        status: "onboarding",
        package: `PBOS ${tierName}`,
        retainer_amount: opportunity.expected_mrr,
        notes: lead.notes || null,
      })
      .select("id")
      .single();
    if (clientError) throw new Error(`Won, but creating the client record failed: ${clientError.message}`);

    const { error: engagementError } = await supabase.from("pbos_engagements").insert({
      client_id: client.id,
      lead_id: lead.id,
      opportunity_id: opportunity.id,
      tier: opportunity.tier,
      setup_fee: opportunity.setup_fee,
      monthly_fee: opportunity.monthly_fee,
      extras: opportunity.extras,
      extras_monthly_value: opportunity.extras_monthly_value,
      contract_start_date: opportunity.contract_start_date,
      contract_term_months: opportunity.contract_term_months,
      status: "onboarding",
    });
    if (engagementError) throw new Error(`Client created, but the engagement didn't save: ${engagementError.message}`);

    // The Social tab is the app's single source of truth for social URLs, so
    // the lead's LinkedIn goes there rather than being dropped on the floor.
    // Best-effort: a failure here must not undo a won deal.
    if (lead.linkedin_url) {
      await supabase.from("social_strategies").insert({
        client_id: client.id,
        platform: "LinkedIn",
        url: lead.linkedin_url,
        is_primary: true,
      });
    }

    const { error: leadError } = await supabase
      .from("pbos_leads")
      .update({ status: "won", converted_client_id: client.id, converted_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (leadError) throw new Error(`Client created, but closing the lead failed: ${leadError.message}`);

    revalidatePbos();
    revalidatePath("/clients");
    return `${lead.name} is now a client on PBOS ${tierName} — onboarding required. Their details and terms came across; start the consultation from their client record.`;
  });
}

// ---------------------------------------------------------------------------
// Next actions on a lead. Deliberately their own table — chasing a proposal
// is business development, not a client's delivery work.
// ---------------------------------------------------------------------------

export async function createLeadAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const leadId = String(formData.get("lead_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!leadId) return { ok: false, message: "Which lead is this for?" };
  if (!title) return { ok: false, message: "What's the next action?" };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerRaw = String(formData.get("owner") ?? "").trim();

    const { error } = await supabase.from("pbos_lead_actions").insert({
      lead_id: leadId,
      opportunity_id: String(formData.get("opportunity_id") ?? "").trim() || null,
      title,
      due_date: String(formData.get("due_date") ?? "").trim() || null,
      owner_user_id: ownerRaw.startsWith("u:") ? ownerRaw.slice(2) : (user?.id ?? null),
    });
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

export async function completeLeadAction(actionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("pbos_lead_actions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

export async function deleteLeadAction(actionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("pbos_lead_actions").delete().eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Engagements — what a won client is on, and what they're actually paying.
// ---------------------------------------------------------------------------

const ENGAGEMENT_FIELDS = [
  "tier",
  "setup_fee",
  "setup_fee_invoiced_on",
  "monthly_fee",
  "extras",
  "extras_monthly_value",
  "actual_mrr",
  "contract_start_date",
  "contract_term_months",
  "notes",
] as const;
type EngagementField = (typeof ENGAGEMENT_FIELDS)[number];

export async function updateEngagementField(clientId: string, field: EngagementField, value: string): Promise<ActionResult> {
  if (!ENGAGEMENT_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };

  let patchValue: string | number | null = value.trim();
  if (["setup_fee", "monthly_fee", "extras_monthly_value", "actual_mrr"].includes(field)) {
    const parsed = parseMoney(value);
    if (parsed === "invalid") return { ok: false, message: "That needs to be a plain positive number, or blank." };
    patchValue = parsed;
  }
  if (field === "tier" && !isTier(String(patchValue))) return { ok: false, message: "Unknown tier." };
  if (field === "contract_term_months") {
    const trimmed = value.trim();
    const n = trimmed ? Number(trimmed) : null;
    if (n !== null && (Number.isNaN(n) || n <= 0)) return { ok: false, message: "Contract term must be a number of months." };
    patchValue = n;
  }
  if (field === "contract_start_date" || field === "setup_fee_invoiced_on") patchValue = value.trim() || null;

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("pbos_engagements")
      .update(fieldPatch<Database["public"]["Tables"]["pbos_engagements"]["Update"]>(field, patchValue))
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePbos();
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}

/** Engagement status and client status move together: they are two views of
 * the same fact, and letting them drift is how a paused client keeps counting
 * towards MRR. */
export async function setEngagementStatus(clientId: string, status: string): Promise<ActionResult> {
  if (!ENGAGEMENT_STATUS.some((s) => s.value === status)) return { ok: false, message: "Unknown status." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("pbos_engagements")
      .update({
        status,
        onboarding_completed_at: status === "active" ? new Date().toISOString() : null,
        ended_on: status === "ended" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);

    const clientStatus = { onboarding: "onboarding", active: "active", paused: "paused", ended: "offboarded" }[status];
    const { error: clientError } = await supabase
      .from("clients")
      .update({ status: clientStatus as Database["public"]["Enums"]["client_status"] })
      .eq("id", clientId);
    if (clientError) throw new Error(`Engagement saved, but the client status didn't follow: ${clientError.message}`);

    revalidatePbos();
    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Tier pricing. Structure first, pricing later — these are the defaults a new
// deal is prefilled from, and changing them never touches a deal already done.
// ---------------------------------------------------------------------------

export async function updateTierDefault(
  tierKey: string,
  field: "default_setup_fee" | "default_monthly_fee",
  value: string,
): Promise<ActionResult> {
  if (!isTier(tierKey)) return { ok: false, message: "Unknown tier." };
  if (field !== "default_setup_fee" && field !== "default_monthly_fee") return { ok: false, message: "Unknown field." };
  const parsed = parseMoney(value);
  if (parsed === "invalid") return { ok: false, message: "Enter the fee as a plain number, or leave it blank." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error, data } = await supabase
      .from("pbos_tiers")
      .update(fieldPatch<Database["public"]["Tables"]["pbos_tiers"]["Update"]>(field, parsed))
      .eq("key", tierKey)
      .select("key");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Only admins can change tier pricing.");
    revalidatePbos();
    return undefined;
  });
}
