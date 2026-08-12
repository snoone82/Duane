import { redirect } from "next/navigation";
import {
  getAuditResponses,
  getCurrentUser,
  getInProgressAudit,
  getLatestCompletedAudit,
  getLifeAreas,
} from "@/lib/audit-data";
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

  return (
    <LeverageClient
      auditId={audit.id}
      lifeAreas={lifeAreas.map((a) => ({ id: a.id, name: a.name }))}
      selectedAreaId={audit.leverage_area_id}
    />
  );
}
