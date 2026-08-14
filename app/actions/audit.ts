"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlySaveError, isNextRedirectError } from "@/lib/errors";
import { computeRecommendedFocus } from "@/lib/recommended-focus";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * Ensures an anonymous session exists and there's an in_progress audit to
 * work with — creating both if needed, resuming if not. This is the only
 * place a new audit is ever created. Runs as a Server Action (not a Server
 * Component) because signing in needs to write session cookies.
 */
export async function startOrResumeAudit(): Promise<ActionResult<{ auditId: string }>> {
  try {
    const supabase = await createClient();

    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Log the real cause for whoever's debugging — a visitor should never
        // see a Supabase config hint like "enable Anonymous sign-in".
        console.error("startOrResumeAudit: anonymous sign-in failed —", error.message);
        return {
          ok: false,
          message:
            "We couldn't get your audit started just now — that's on us, not you. Try again in a moment.",
        };
      }
      user = data.user;
    }

    if (!user) {
      return { ok: false, message: "We couldn't start your audit. Try again in a moment." };
    }

    const { data: existing, error: existingError } = await supabase
      .from("audits")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: friendlySaveError(existingError.message) };
    }

    if (existing) {
      return { ok: true, data: { auditId: existing.id } };
    }

    const { data: created, error: insertError } = await supabase
      .from("audits")
      .insert({ user_id: user.id })
      .select("id")
      .single();

    if (insertError || !created) {
      return { ok: false, message: friendlySaveError(insertError?.message) };
    }

    return { ok: true, data: { auditId: created.id } };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("startOrResumeAudit: unexpected error —", error);
    return {
      ok: false,
      message:
        "We couldn't get your audit started just now — that's on us, not you. Try again in a moment.",
    };
  }
}

export async function saveAuditResponse(input: {
  auditId: string;
  lifeAreaId: string;
  satisfactionScore: number;
  importanceScore: number;
  /**
   * Four optional reflection fields, per the brief's "for every life area we
   * need to capture: why, what's working, what's not, one-point move".
   * Deliberately optional — Duane's own steer was to keep the Audit itself a
   * snapshot rather than force deep reflection on every area, so these never
   * block Continue the way satisfaction/importance do.
   */
  whyThisScore: string | null;
  whatsWorking: string | null;
  whatsNotWorking: string | null;
  nextPointMove: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const trimmedOrNull = (value: string | null) => (value?.trim() ? value.trim() : null);

    const { error } = await supabase.from("audit_responses").upsert(
      {
        audit_id: input.auditId,
        life_area_id: input.lifeAreaId,
        satisfaction_score: input.satisfactionScore,
        importance_score: input.importanceScore,
        why_this_score: trimmedOrNull(input.whyThisScore),
        whats_working: trimmedOrNull(input.whatsWorking),
        whats_not_working: trimmedOrNull(input.whatsNotWorking),
        next_point_move: trimmedOrNull(input.nextPointMove),
      },
      { onConflict: "audit_id,life_area_id" }
    );

    if (error) {
      return { ok: false, message: friendlySaveError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("saveAuditResponse: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

export async function setLeverageArea(input: {
  auditId: string;
  lifeAreaId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("audits")
      .update({ leverage_area_id: input.lifeAreaId })
      .eq("id", input.auditId);

    if (error) {
      return { ok: false, message: friendlySaveError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("setLeverageArea: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}

export async function completeAudit(
  auditId: string
): Promise<ActionResult<{ totalScore: number; alreadyCompleted: boolean }>> {
  try {
    const supabase = await createClient();

    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id, status, total_score, leverage_area_id")
      .eq("id", auditId)
      .single();

    if (auditError || !audit) {
      return { ok: false, message: friendlySaveError(auditError?.message) };
    }

    if (audit.status === "completed") {
      return {
        ok: true,
        data: { totalScore: audit.total_score ?? 0, alreadyCompleted: true },
      };
    }

    const [{ data: lifeAreas, error: lifeAreasError }, { data: responses, error: responsesError }] =
      await Promise.all([
        supabase.from("life_areas").select("id, name").eq("is_active", true),
        supabase
          .from("audit_responses")
          .select("satisfaction_score, importance_score, life_area_id")
          .eq("audit_id", auditId),
      ]);

    if (lifeAreasError || responsesError) {
      return { ok: false, message: friendlySaveError(lifeAreasError?.message ?? responsesError?.message) };
    }

    const answeredAreaIds = new Set((responses ?? []).map((r) => r.life_area_id));
    const allAnswered = (lifeAreas ?? []).every((area) => answeredAreaIds.has(area.id));

    if (!allAnswered) {
      return {
        ok: false,
        message: "A few areas still need answers before we can wrap this up — let's go back and finish those.",
      };
    }

    if (!audit.leverage_area_id) {
      return {
        ok: false,
        message: "One more thing first — pick which area would help the others most, then we can finish up.",
      };
    }

    const totalScore = (responses ?? []).reduce((sum, r) => sum + r.satisfaction_score, 0);

    // Recommended Focus Area (brief §1/§6) — a rules-based suggestion stored
    // alongside the user's own leverage_area_id choice, never overriding it.
    // See lib/recommended-focus.ts for what this does and doesn't do.
    const nameById = new Map((lifeAreas ?? []).map((a) => [a.id, a.name]));
    const recommended = computeRecommendedFocus(
      (responses ?? []).map((r) => ({
        lifeAreaId: r.life_area_id,
        lifeAreaName: nameById.get(r.life_area_id) ?? "",
        satisfactionScore: r.satisfaction_score,
        importanceScore: r.importance_score,
      }))
    );

    const { error: updateError } = await supabase
      .from("audits")
      .update({
        status: "completed",
        total_score: totalScore,
        completed_at: new Date().toISOString(),
        recommended_focus_area_id: recommended?.lifeAreaId ?? null,
        recommended_focus_rationale: recommended?.rationale ?? null,
      })
      .eq("id", auditId);

    if (updateError) {
      return { ok: false, message: friendlySaveError(updateError.message) };
    }

    return { ok: true, data: { totalScore, alreadyCompleted: false } };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("completeAudit: unexpected error —", error);
    return { ok: false, message: friendlySaveError(undefined) };
  }
}
