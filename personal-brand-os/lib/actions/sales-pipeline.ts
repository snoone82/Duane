"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { SALES_STAGES, type SalesStage } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

function revalidateSales(clientId?: string) {
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/actions");
  if (clientId) revalidatePath(`/clients/${clientId}/overview`);
}

const VALUE_TYPES = ["monthly", "project"];
const isStage = (value: string): value is SalesStage => SALES_STAGES.some((s) => s.value === value);

/** Create an opportunity against a client/prospect record (Duane: a
 * prospect IS a client with status 'prospect' — nothing is ever created
 * twice). */
export async function createOpportunity(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!clientId) return { ok: false, message: "Pick the prospect or client this opportunity belongs to." };
  if (!title) return { ok: false, message: "Name the service or offer being sold." };

  const valueRaw = String(formData.get("estimated_value") ?? "").trim();
  const estimatedValue = valueRaw ? Number(valueRaw) : null;
  if (valueRaw && Number.isNaN(estimatedValue)) return { ok: false, message: "Estimated value must be a number." };
  const probabilityRaw = Number(String(formData.get("probability") ?? "50"));
  const probability = Number.isNaN(probabilityRaw) ? 50 : Math.max(0, Math.min(100, Math.round(probabilityRaw)));
  const valueType = String(formData.get("value_type") ?? "monthly");

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ownerRaw = String(formData.get("owner") ?? "").trim();
    const ownerUserId = ownerRaw.startsWith("u:") ? ownerRaw.slice(2) : (user?.id ?? null);

    const { error } = await supabase.from("sales_opportunities").insert({
      client_id: clientId,
      title,
      contact_name: String(formData.get("contact_name") ?? "").trim(),
      estimated_value: estimatedValue,
      value_type: VALUE_TYPES.includes(valueType) ? valueType : "monthly",
      probability,
      expected_close: String(formData.get("expected_close") ?? "").trim() || null,
      owner_user_id: ownerUserId,
      source: String(formData.get("source") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      stage_history: [{ stage: "prospect", at: new Date().toISOString() }],
    });
    if (error) throw new Error(error.message);
    revalidateSales(clientId);
    return undefined;
  });
}

const FIELDS = ["title", "contact_name", "source", "notes", "expected_close", "estimated_value", "probability", "value_type"] as const;
type Field = (typeof FIELDS)[number];

export async function updateOpportunityField(opportunityId: string, field: Field, value: string): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "The offer name can't be empty." };

  let patchValue: string | number | null = value.trim();
  if (field === "estimated_value") {
    patchValue = value.trim() ? Number(value) : null;
    if (patchValue !== null && Number.isNaN(patchValue)) return { ok: false, message: "Value must be a number." };
  }
  if (field === "probability") {
    const n = Number(value);
    if (Number.isNaN(n)) return { ok: false, message: "Probability must be a number." };
    patchValue = Math.max(0, Math.min(100, Math.round(n)));
  }
  if (field === "expected_close") patchValue = value.trim() || null;
  if (field === "value_type" && !VALUE_TYPES.includes(value)) return { ok: false, message: "Unknown value type." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("sales_opportunities")
      .update(fieldPatch<Database["public"]["Tables"]["sales_opportunities"]["Update"]>(field, patchValue))
      .eq("id", opportunityId)
      .select("client_id")
      .single();
    if (error) throw new Error(error.message);
    revalidateSales(row.client_id);
    return undefined;
  });
}

/** Move an opportunity along the journey. Stage changes append to the
 * timeline; Won converts a prospect into an active client automatically —
 * same record, history intact (Duane's Won → Active Client). */
export async function setOpportunityStage(opportunityId: string, stage: string): Promise<ActionResult<string | undefined>> {
  if (!isStage(stage)) return { ok: false, message: "Unknown stage." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("sales_opportunities")
      .select("client_id,stage,stage_history,client:clients(status,name)")
      .eq("id", opportunityId)
      .single();
    if (readError) throw new Error(readError.message);
    if (current.stage === stage) return undefined;

    const history = Array.isArray(current.stage_history) ? current.stage_history : [];
    const terminal = stage === "won" || stage === "lost";
    const { error } = await supabase
      .from("sales_opportunities")
      .update({
        stage,
        stage_history: [...history, { stage, at: new Date().toISOString() }],
        closed_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", opportunityId);
    if (error) throw new Error(error.message);

    let message: string | undefined;
    if (stage === "won" && current.client?.status === "prospect") {
      const { error: convertError } = await supabase
        .from("clients")
        .update({ status: "active" })
        .eq("id", current.client_id);
      if (convertError) throw new Error(`Won, but converting the prospect failed: ${convertError.message}`);
      message = `${current.client?.name ?? "The prospect"} is now an active client — same record, full history kept.`;
      revalidatePath("/clients");
    }
    revalidateSales(current.client_id);
    return message;
  });
}

/** The "next action" on an opportunity is a real Action — linked here, and
 * therefore in the backlog, the calendar and the client's Actions tab. */
export async function createOpportunityAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const opportunityId = String(formData.get("opportunity_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "What's the next action?" };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerRaw = String(formData.get("owner") ?? "").trim();

    const { error } = await supabase.from("actions").insert({
      client_id: clientId,
      title,
      due_date: String(formData.get("due_date") ?? "").trim() || null,
      owner_user_id: ownerRaw.startsWith("u:") ? ownerRaw.slice(2) : (user?.id ?? null),
      source: "opportunity",
      sales_opportunity_id: opportunityId,
    });
    if (error) throw new Error(error.message);
    revalidateSales(clientId);
    return undefined;
  });
}

export async function deleteOpportunity(opportunityId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("sales_opportunities")
      .delete()
      .eq("id", opportunityId)
      .select("client_id")
      .single();
    if (error) throw new Error(error.message);
    revalidateSales(row.client_id);
    return undefined;
  });
}
