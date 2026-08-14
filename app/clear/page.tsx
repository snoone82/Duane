import { redirect } from "next/navigation";
import {
  getAuditResponses,
  getCompletedAudits,
  getCurrentUser,
  getLatestClearPlan,
  getLifeAreas,
} from "@/lib/audit-data";
import { CLEAR_STEPS } from "@/lib/clear-steps";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { Logo } from "@/components/ui/Logo";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ClearIntroClient } from "@/components/clear/ClearIntroClient";
import { ClearReflectionStepClient } from "@/components/clear/ClearReflectionStepClient";
import { ClearGoalStepClient } from "@/components/clear/ClearGoalStepClient";

export default async function ClearPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const completedAudits = await getCompletedAudits(user.id);
  const latestAudit = completedAudits.at(-1) ?? null;

  if (!latestAudit || !latestAudit.leverage_area_id) {
    return (
      <SessionNotice message="Finish the Audit and choose which area would help the others most before starting CLEAR." />
    );
  }

  const lifeAreas = await getLifeAreas();
  const focusArea = lifeAreas.find((a) => a.id === latestAudit.leverage_area_id);
  if (!focusArea) {
    return <SessionNotice message="This focus area isn't available right now — check back shortly." />;
  }

  const clearPlan = await getLatestClearPlan(user.id);

  if (!clearPlan) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
        <Logo className="mb-8" />
        <p className="label-caps text-sm text-gold">Before you begin</p>
        <h1 className="mt-2 font-heading text-2xl text-ink">The CLEAR Framework</h1>
        <p className="mt-3 text-base leading-snug text-ink-soft">
          It guides you through five steps — understanding where you are, clarifying who you&apos;re
          becoming, facing what&apos;s in the way, choosing a meaningful goal, and creating a plan
          to follow through.
        </p>
        <div className="mt-8">
          <ClearIntroClient auditId={latestAudit.id} lifeAreaId={focusArea.id} lifeAreaName={focusArea.name} />
        </div>
      </main>
    );
  }

  if (clearPlan.status === "completed") {
    redirect("/dashboard");
  }

  const maxReachableStep = clearPlan.current_step;
  const requestedStep = Number(step);
  const currentStep =
    Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= maxReachableStep
      ? requestedStep
      : maxReachableStep;

  // Personalization (brief §7): quote the person's own audit answers back to
  // them rather than claiming pattern-analysis that isn't actually
  // happening — see the comment on ClearReflectionStepClient's
  // personalizedIntro prop.
  const auditResponses = await getAuditResponses(latestAudit.id);
  const focusResponse = auditResponses.find((r) => r.life_area_id === focusArea.id) ?? null;
  const personalizedIntro = focusResponse
    ? `Based on what you told us about ${focusArea.name} — you rated it ${focusResponse.satisfaction_score}/10${
        focusResponse.why_this_score ? `, and said: "${focusResponse.why_this_score}"` : ""
      }.`
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <ProgressBar current={currentStep} total={5} />

      <div className="mt-8 flex flex-1 flex-col">
        {currentStep === 4 ? (
          <ClearGoalStepClient clearPlanId={clearPlan.id} lifeAreaId={focusArea.id} lifeAreaName={focusArea.name} />
        ) : (
          (() => {
            const stepConfig = CLEAR_STEPS.find((s) => s.step === currentStep);
            if (!stepConfig) {
              return <SessionNotice message="That step isn't available — let's pick back up from the start of CLEAR." />;
            }
            const existingValues = Object.fromEntries(
              stepConfig.fields.map((f) => [f.key, (clearPlan as unknown as Record<string, string | null>)[f.key] ?? null])
            );
            return (
              <ClearReflectionStepClient
                clearPlanId={clearPlan.id}
                stepConfig={stepConfig}
                personalizedIntro={personalizedIntro}
                existingValues={existingValues}
              />
            );
          })()
        )}
      </div>
    </main>
  );
}
