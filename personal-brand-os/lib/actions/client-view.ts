"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { buildMonthlyPlanExport } from "@/lib/actions/monthly-plans";
import { buildClientView, clientVisibleFingerprint, type ClientView } from "@/lib/client-view";

/**
 * The Client View and its approval.
 *
 * The view is a projection of the same MonthlyPlanExport the Structured Plan
 * Export produces — Duane's point, and the reason nothing here generates
 * anything. Approval records WHICH VERSION was signed off, by storing a
 * fingerprint of the client-visible fields; a later change to any of them
 * shows the plan as changed since approval.
 */

export interface ClientViewResult {
  view: ClientView;
  approval: {
    approvedAt: string | null;
    approvedRevision: number | null;
    /** True when a client-visible field has changed since sign-off. */
    changedSinceApproval: boolean;
    /** Approve Month is only offered once publish dates exist. */
    canApprove: boolean;
    blockedReason: string | null;
  };
}

export async function getClientView(clientId: string, planId: string): Promise<ActionResult<ClientViewResult>> {
  return runAction(async () => {
    const doc = await buildMonthlyPlanExport(clientId, planId);
    const view = buildClientView(doc);

    const supabase = await createClient();
    const { data: plan, error } = await supabase
      .from("monthly_plans")
      .select("approved_at,approved_revision,approved_fingerprint,revision")
      .eq("id", planId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);

    const current = clientVisibleFingerprint(view);
    const approved = Boolean(plan.approved_at);

    return {
      view,
      approval: {
        approvedAt: plan.approved_at,
        approvedRevision: plan.approved_revision,
        changedSinceApproval: approved && plan.approved_fingerprint !== current,
        canApprove: !approved && view.datesAssigned,
        blockedReason: approved
          ? null
          : view.totals.outputs === 0
            ? "Generate the Platform Outputs (Stage 2) before sending this for sign-off."
            : !view.datesAssigned
              ? "Assign publish dates before approving — the client is signing off a schedule, not just a list."
              : null,
      },
    };
  });
}

/**
 * Approve the month, against the version on screen.
 *
 * The fingerprint is computed here rather than passed in from the browser:
 * what gets recorded as approved must be what PBOS actually holds at this
 * moment, not what a stale page thought it held.
 */
export async function approveMonthlyPlan(clientId: string, planId: string, note: string): Promise<ActionResult> {
  return runAction(async () => {
    const doc = await buildMonthlyPlanExport(clientId, planId);
    const view = buildClientView(doc);
    if (!view.datesAssigned) {
      throw new UserFacingError("Assign publish dates before approving — the client is signing off a schedule, not just a list.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: plan, error: readError } = await supabase
      .from("monthly_plans")
      .select("revision")
      .eq("id", planId)
      .eq("client_id", clientId)
      .single();
    if (readError) throw new UserFacingError(readError.message);

    const { error } = await supabase
      .from("monthly_plans")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
        approved_note: note.trim(),
        approved_revision: plan.revision,
        approved_fingerprint: clientVisibleFingerprint(view),
      })
      .eq("id", planId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);

    revalidatePath(`/clients/${clientId}/plans`, "layout");
    return undefined;
  });
}

/** Withdraw an approval — back to review, and the fingerprint goes with it
 * so nothing later claims to be covered by a sign-off that no longer holds. */
export async function withdrawApproval(clientId: string, planId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("monthly_plans")
      .update({
        status: "in_review",
        approved_at: null,
        approved_by: null,
        approved_note: "",
        approved_revision: null,
        approved_fingerprint: "",
      })
      .eq("id", planId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidatePath(`/clients/${clientId}/plans`, "layout");
    return undefined;
  });
}

/** Re-confirm an approval after a client-visible change, against the version
 * as it now stands. Kept separate from approve so the act of re-approving is
 * deliberate rather than something a stale page does silently. */
export async function reapproveMonthlyPlan(clientId: string, planId: string): Promise<ActionResult> {
  return approveMonthlyPlan(clientId, planId, "Re-approved after a client-visible change.");
}
