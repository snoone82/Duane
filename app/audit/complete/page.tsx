import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getInProgressAudit,
  getLatestCompletedAudit,
  getProfile,
} from "@/lib/audit-data";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { CompleteAuditClient } from "@/components/audit/CompleteAuditClient";

export default async function CompleteAuditPage() {
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const profile = await getProfile(user.id);
  const inProgress = await getInProgressAudit(user.id);

  if (inProgress) {
    return <CompleteAuditClient auditId={inProgress.id} initialTotalScore={null} />;
  }

  const completed = await getLatestCompletedAudit(user.id);

  if (!completed) {
    return <SessionNotice message="There's no audit ready to complete yet — let's start one." />;
  }

  // Already has a permanent account and a completed audit — nothing left to
  // do here, their results are on the dashboard.
  if (profile && !profile.is_anonymous) {
    redirect("/dashboard");
  }

  return (
    <CompleteAuditClient auditId={completed.id} initialTotalScore={completed.total_score ?? 0} />
  );
}
