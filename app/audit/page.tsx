import { redirect } from "next/navigation";
import {
  getAuditResponses,
  getCurrentUser,
  getInProgressAudit,
  getLatestCompletedAudit,
  getLifeAreas,
} from "@/lib/audit-data";
import { AuditAreaClient } from "@/components/audit/AuditAreaClient";
import { SessionNotice } from "@/components/audit/SessionNotice";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return <SessionNotice />;
  }

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

  if (lifeAreas.length === 0) {
    return <SessionNotice message="The Audit isn't set up yet — check back shortly." />;
  }

  const responseByAreaId = new Map(responses.map((r) => [r.life_area_id, r]));
  const firstUnansweredIndex = lifeAreas.findIndex((a) => !responseByAreaId.has(a.id));

  if (firstUnansweredIndex === -1) {
    redirect("/audit/leverage");
  }

  const maxReachableStep = firstUnansweredIndex + 1; // 1-based
  const requestedStep = Number(step);
  const currentStep =
    Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= maxReachableStep
      ? requestedStep
      : maxReachableStep;

  const currentArea = lifeAreas[currentStep - 1];

  // Not reachable given the clamping above, but life_areas can change
  // between the two queries above (Duane reordering/deactivating content
  // mid-request) — fail gracefully rather than crash on `.id` of undefined.
  if (!currentArea) {
    return <SessionNotice message="This area isn't available right now — let's pick back up from the start of the Audit." />;
  }

  const existingResponse = responseByAreaId.get(currentArea.id) ?? null;

  return (
    <AuditAreaClient
      auditId={audit.id}
      area={currentArea}
      stepIndex={currentStep}
      totalSteps={lifeAreas.length}
      existingResponse={
        existingResponse
          ? {
              satisfactionScore: existingResponse.satisfaction_score,
              importanceScore: existingResponse.importance_score,
              note: existingResponse.note,
            }
          : null
      }
    />
  );
}
