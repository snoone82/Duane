/**
 * Rules-based "Recommended Focus Area" — the brief's §6 wants the system to
 * analyse scores, written answers, cross-area patterns and what the user
 * says matters most, then recommend a focus with a written rationale.
 *
 * This only does the first, simplest slice of that: the same
 * importance × (10 − satisfaction) weighting audit_responses.priority_score
 * already uses, picking the single highest-weighted area. It does not read
 * the written reflection fields (why_this_score, whats_working, etc.) or
 * spot cross-area patterns — that needs a real model call, not more rules.
 *
 * Deliberately honest about that limit in the rationale text below, rather
 * than writing copy that implies more analysis happened than actually did.
 * Swapping this out for a real AI-generated recommendation later only means
 * replacing this one function — every caller already treats the result as
 * "a suggestion, never enforced" (see audits.recommended_focus_area_id's
 * column comment in the migration).
 */

export type RecommendedFocusInput = {
  lifeAreaId: string;
  lifeAreaName: string;
  satisfactionScore: number;
  importanceScore: number;
};

export type RecommendedFocus = {
  lifeAreaId: string;
  lifeAreaName: string;
  rationale: string;
};

export function computeRecommendedFocus(
  responses: RecommendedFocusInput[]
): RecommendedFocus | null {
  if (responses.length === 0) return null;

  let best = responses[0]!;
  let bestWeight = weight(best);

  for (const response of responses.slice(1)) {
    const responseWeight = weight(response);
    // Tie-break on the lower satisfaction score — between two equally
    // important areas, the one with further to go wins.
    if (
      responseWeight > bestWeight ||
      (responseWeight === bestWeight && response.satisfactionScore < best.satisfactionScore)
    ) {
      best = response;
      bestWeight = responseWeight;
    }
  }

  return {
    lifeAreaId: best.lifeAreaId,
    lifeAreaName: best.lifeAreaName,
    rationale: `Based on your ratings, ${best.lifeAreaName} stands out — you scored it ${best.satisfactionScore}/10 while saying it matters ${best.importanceScore}/5. Areas that matter this much with room to grow tend to create the most momentum when you focus on them first.`,
  };
}

function weight(r: RecommendedFocusInput): number {
  return r.importanceScore * (10 - r.satisfactionScore);
}
