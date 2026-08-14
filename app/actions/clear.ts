"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlySaveError, isNextRedirectError } from "@/lib/errors";
import type { GoalFrequency, GoalTrackMetric, GoalType } from "@/lib/database.types";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * Ensures a CLEAR plan exists for the given audit's focus area — creating
 * one if needed, resuming if not. Mirrors startOrResumeAudit in
 * app/actions/audit.ts: this is the only place a new clear_plans row is
 * ever created, and it only happens on an explicit "Begin CLEAR" click, not
 * on page load, for the same reason — reading the intro and leaving
 * shouldn't leave a stray in-progress row behind.
 */
export async function startOrResumeClearPlan(input: {
  auditId: string;
  lifeAreaId: string;
}): Promise<ActionResult<{ clearPlanId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, message: "Your session's expired — refresh and try again." };
    }

    const { data: existing, error: existingError } = await supabase
      .from("clear_plans")
      .select("id")
      .eq("audit_id", input.auditId)
      .eq("life_area_id", input.lifeAreaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: friendlySaveError(existingError.message) };
    }

    if (existing) {
      return { ok: true, data: { clearPlanId: existing.id } };
    }

    const { data: created, error: insertError } = await supabase
      .from("clear_plans")
      .insert({ user_id: user.id, audit_id: input.auditId, life_area_id: input.lifeAreaId })
      .select("id")
      .single();

    if (insertError || !created) {
      return { ok: false, message: friendlySaveError(insertError?.message) };
    }

    return { ok: true, data: { clearPlanId: created.id } };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("startOrResumeClearPlan: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

/** Saves one step's fields and advances current_step if moving forward — never backward, so Back navigation doesn't lose the "furthest reached" marker. */
export async function saveClearStep(input: {
  clearPlanId: string;
  step: number;
  fields: Record<string, string | null>;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: plan, error: planError } = await supabase
      .from("clear_plans")
      .select("current_step")
      .eq("id", input.clearPlanId)
      .single();

    if (planError || !plan) {
      return { ok: false, message: friendlySaveError(planError?.message) };
    }

    const trimmed: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(input.fields)) {
      trimmed[key] = value?.trim() ? value.trim() : null;
    }

    const { error } = await supabase
      .from("clear_plans")
      .update({
        ...trimmed,
        current_step: Math.max(plan.current_step, Math.min(input.step + 1, 5)),
      })
      .eq("id", input.clearPlanId);

    if (error) {
      return { ok: false, message: friendlySaveError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("saveClearStep: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

/** Step 4 (Aligned Goal) creates the primary `goals` row and links it back via clear_plans.goal_id — the goal itself doesn't live on clear_plans, see the migration comment on that column. */
export async function createGoalFromClear(input: {
  clearPlanId: string;
  lifeAreaId: string;
  goalType: GoalType;
  actionText: string;
  frequency: GoalFrequency;
  frequencyCustom: string | null;
  successCriteria: string;
  trackMetric: GoalTrackMetric;
  trackMetricCustom: string | null;
  motivationText: string;
}): Promise<ActionResult<{ goalId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, message: "Your session's expired — refresh and try again." };
    }

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        life_area_id: input.lifeAreaId,
        clear_plan_id: input.clearPlanId,
        role: "primary",
        goal_type: input.goalType,
        action_text: input.actionText,
        frequency: input.frequency,
        frequency_custom: input.frequencyCustom?.trim() ? input.frequencyCustom.trim() : null,
        success_criteria: input.successCriteria,
        track_metric: input.trackMetric,
        track_metric_custom: input.trackMetricCustom?.trim() ? input.trackMetricCustom.trim() : null,
        motivation_text: input.motivationText,
      })
      .select("id")
      .single();

    if (goalError || !goal) {
      return { ok: false, message: friendlySaveError(goalError?.message) };
    }

    const { error: linkError } = await supabase
      .from("clear_plans")
      .update({ goal_id: goal.id, current_step: 5 })
      .eq("id", input.clearPlanId);

    if (linkError) {
      return { ok: false, message: friendlySaveError(linkError.message) };
    }

    return { ok: true, data: { goalId: goal.id } };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("createGoalFromClear: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

export async function completeClearPlan(clearPlanId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: plan, error: planError } = await supabase
      .from("clear_plans")
      .select("status, goal_id")
      .eq("id", clearPlanId)
      .single();

    if (planError || !plan) {
      return { ok: false, message: friendlySaveError(planError?.message) };
    }

    if (plan.status === "completed") {
      return { ok: true, data: undefined };
    }

    if (!plan.goal_id) {
      return {
        ok: false,
        message: "One more thing first — set your Aligned Goal before finishing CLEAR.",
      };
    }

    const { error } = await supabase
      .from("clear_plans")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", clearPlanId);

    if (error) {
      return { ok: false, message: friendlySaveError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("completeClearPlan: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

/** Adds a supporting goal directly from My Goals — no CLEAR required. The database trigger enforces the 1 primary + 2 supporting limit; a rejected insert surfaces as a friendly "slots full" message via friendlySaveError. */
export async function createSupportingGoal(input: {
  lifeAreaId: string;
  goalType: GoalType;
  actionText: string;
  frequency: GoalFrequency;
  frequencyCustom: string | null;
  successCriteria: string;
  trackMetric: GoalTrackMetric;
  trackMetricCustom: string | null;
  motivationText: string;
}): Promise<ActionResult<{ goalId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, message: "Your session's expired — refresh and try again." };
    }

    const { data: goal, error } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        life_area_id: input.lifeAreaId,
        role: "supporting",
        goal_type: input.goalType,
        action_text: input.actionText,
        frequency: input.frequency,
        frequency_custom: input.frequencyCustom?.trim() ? input.frequencyCustom.trim() : null,
        success_criteria: input.successCriteria,
        track_metric: input.trackMetric,
        track_metric_custom: input.trackMetricCustom?.trim() ? input.trackMetricCustom.trim() : null,
        motivation_text: input.motivationText,
      })
      .select("id")
      .single();

    if (error || !goal) {
      return { ok: false, message: friendlySaveError(error?.message) };
    }

    return { ok: true, data: { goalId: goal.id } };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("createSupportingGoal: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

/** A daily check-in — upserted by (goal_id, checkin_date), same pattern as saveAuditResponse. */
export async function saveCheckin(input: {
  goalId: string;
  checkinDate: string;
  actionCompleted: boolean;
  confidenceScore: number | null;
  selfTrustScore: number | null;
  note: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("checkins").upsert(
      {
        goal_id: input.goalId,
        checkin_date: input.checkinDate,
        action_completed: input.actionCompleted,
        confidence_score: input.confidenceScore,
        self_trust_score: input.selfTrustScore,
        note: input.note?.trim() ? input.note.trim() : null,
      },
      { onConflict: "goal_id,checkin_date" }
    );

    if (error) {
      return { ok: false, message: friendlySaveError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("saveCheckin: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}
