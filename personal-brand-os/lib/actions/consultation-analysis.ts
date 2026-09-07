"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { SOURCE_ITEM_KINDS } from "@/lib/monthly-plan-format";

/**
 * Reviewing a consultation analysis.
 *
 * Duane's rule holds throughout: the transcript is the evidence, the
 * extraction is an interpretation of it, and nothing crosses into the
 * Source Library or the client's profile without a person approving it.
 * Rejections are kept rather than deleted so a later re-analysis can be told
 * what a reviewer has already turned down.
 */

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/consultations`);
  revalidatePath(`/clients/${clientId}/plans`, "layout");
}

/**
 * Save a consultation and hand back its id, so the import flow can analyse
 * it straight away. Separate from createConsultation (which returns nothing,
 * being a plain form action) because the raw record must exist and be
 * durable BEFORE analysis is attempted — if the AI call then fails, the
 * evidence is still safely stored.
 */
export async function createConsultationForAnalysis(formData: FormData): Promise<ActionResult<string>> {
  const clientId = String(formData.get("client_id") ?? "");
  const meetingDate = String(formData.get("meeting_date") ?? "").trim();
  const transcript = String(formData.get("transcript") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!meetingDate) return { ok: false, message: "The consultation date is required." };
  if (!transcript && !summary) return { ok: false, message: "Add a transcript or some notes — there's nothing to analyse yet." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("consultations")
      .insert({
        client_id: clientId,
        meeting_date: meetingDate,
        meeting_type: String(formData.get("meeting_type") ?? "").trim() || null,
        title: String(formData.get("title") ?? "").trim(),
        attendees: String(formData.get("attendees") ?? "").trim(),
        summary,
        transcript,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new UserFacingError(error.message);
    revalidate(clientId);
    return data.id;
  });
}

/** Approve one proposed item — this is the only path into the Source
 * Library from an analysis. Edits made in the review panel are passed in,
 * so what gets saved is what the reviewer actually approved. */
export async function approveSourceProposal(
  clientId: string,
  proposalId: string,
  edited?: { kind?: string; text?: string; sensitivity?: "public" | "sensitive" }
): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: proposal, error: readError } = await supabase
      .from("consultation_source_proposals")
      .select("id,client_id,analysis_id,kind,text,source_quote,sensitivity,state,source_item_id")
      .eq("id", proposalId)
      .eq("client_id", clientId)
      .single();
    if (readError) throw new UserFacingError(readError.message);
    if (proposal.state === "approved" && proposal.source_item_id) {
      throw new UserFacingError("That item has already been saved to the Source Library.");
    }

    const kind = (edited?.kind ?? proposal.kind).trim();
    const text = (edited?.text ?? proposal.text).trim();
    if (!text) throw new UserFacingError("The item can't be saved empty — edit it or reject it.");
    if (!SOURCE_ITEM_KINDS.some((k) => k.value === kind)) throw new UserFacingError(`"${kind}" isn't a valid kind of source item.`);

    // The consultation this came from, so the saved item keeps its
    // provenance — which meeting, and on what date.
    const { data: analysis } = await supabase
      .from("consultation_analyses")
      .select("consultation_id,consultations(meeting_date)")
      .eq("id", proposal.analysis_id)
      .single();
    const meetingDate = (analysis?.consultations as { meeting_date: string } | null)?.meeting_date ?? null;

    const { data: created, error: insertError } = await supabase
      .from("client_source_items")
      .insert({
        client_id: clientId,
        consultation_id: analysis?.consultation_id ?? null,
        kind,
        text,
        source_quote: proposal.source_quote,
        source_date: meetingDate,
        sensitivity: edited?.sensitivity ?? proposal.sensitivity,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (insertError) throw new UserFacingError(insertError.message);

    const { error: updateError } = await supabase
      .from("consultation_source_proposals")
      .update({ state: "approved", kind, text, sensitivity: edited?.sensitivity ?? proposal.sensitivity, source_item_id: created.id })
      .eq("id", proposalId);
    if (updateError) throw new UserFacingError(updateError.message);

    revalidate(clientId);
    return undefined;
  });
}

export async function rejectSourceProposal(clientId: string, proposalId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("consultation_source_proposals")
      .update({ state: "rejected" })
      .eq("id", proposalId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidate(clientId);
    return undefined;
  });
}

/** Approve every still-pending proposal in one analysis. */
export async function approveAllSourceProposals(clientId: string, analysisId: string): Promise<ActionResult<number>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: pending, error } = await supabase
      .from("consultation_source_proposals")
      .select("id")
      .eq("analysis_id", analysisId)
      .eq("client_id", clientId)
      .eq("state", "pending");
    if (error) throw new UserFacingError(error.message);

    let saved = 0;
    for (const row of pending ?? []) {
      const result = await approveSourceProposal(clientId, row.id);
      if (!result.ok) throw new UserFacingError(result.message);
      saved += 1;
    }
    revalidate(clientId);
    return saved;
  });
}

/**
 * Accept or decline a suggested profile change.
 *
 * Approving records the decision — it deliberately does NOT rewrite the
 * client's profile. Duane: "A client thinking aloud in a meeting should not
 * automatically become a permanent strategy change." An accepted suggestion
 * shows what to change and where; the edit itself stays a human action on
 * the relevant tab.
 */
export async function setProfileSuggestionState(
  clientId: string,
  suggestionId: string,
  state: "approved" | "rejected" | "pending"
): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profile_change_suggestions")
      .update({ state })
      .eq("id", suggestionId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidate(clientId);
    return undefined;
  });
}

/** Mark the review finished. The analysis and its proposals are kept — the
 * record of what was extracted and what a person decided about it. */
export async function completeAnalysisReview(clientId: string, analysisId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("consultation_analyses")
      .update({ state: "completed" })
      .eq("id", analysisId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidate(clientId);
    return undefined;
  });
}

export async function discardAnalysis(clientId: string, analysisId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    // The analysis row goes, and its proposals cascade with it. The
    // consultation and its transcript are untouched — the evidence survives
    // every interpretation of it.
    const { error } = await supabase.from("consultation_analyses").delete().eq("id", analysisId).eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidate(clientId);
    return undefined;
  });
}
