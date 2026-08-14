import { redirect } from "next/navigation";
import {
  getAuditResponses,
  getCurrentUser,
  getInProgressAudit,
  getLatestCompletedAudit,
  getLifeAreas,
} from "@/lib/audit-data";
import { computeRecommendedFocus } from "@/lib/recommended-focus";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { LeverageClient } from "@/components/audit/LeverageClient";

export default async function LeveragePage() {
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const audit = await getInProgressAudit(user.id);
  if (!audit) {
    const completed = await getLatestCompletedAudit(user.id);
    if (completed) redirect("/dashboard");
    return <SessionNotice />;
  }

  const [lifeAreas, responses] = await Promise.all([
    getLifeAreas(),
    getAuditResponses(audit.id),
  ]);

  const answeredIds = new Set(responses.map((r) => r.life_area_id));
  const allAnswered = lifeAreas.every((a) => answeredIds.has(a.id));

  if (!allAnswered) {
    redirect("/audit");
  }

  const nameById = new Map(lifeAreas.map((a) => [a.id, a.name]));
  const recommended = computeRecommendedFocus(
    responses.map((r) => ({
      lifeAreaId: r.life_area_id,
      lifeAreaName: nameById.get(r.life_area_id) ?? "",
      satisfactionScore: r.satisfaction_score,
      importanceScore: r.importance_score,
    }))
  );

  return (
    <LeverageClient
      auditId={audit.id}
      lifeAreas={lifeAreas.map((a) => ({ id: a.id, name: a.name }))}
      selectedAreaId={audit.leverage_area_id}
      recommended={recommended}
    />
  );
}
