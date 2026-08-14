import Link from "next/link";
import {
  getActiveGoal,
  getActiveSupportingGoals,
  getCheckins,
  getCurrentUser,
  getLifeAreas,
  summarizeCheckins,
} from "@/lib/audit-data";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { Logo } from "@/components/ui/Logo";
import { AddSupportingGoalClient } from "@/components/goals/AddSupportingGoalClient";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const [primaryGoal, supportingGoals, lifeAreas] = await Promise.all([
    getActiveGoal(user.id, "primary"),
    getActiveSupportingGoals(user.id),
    getLifeAreas(),
  ]);

  const nameById = new Map(lifeAreas.map((a) => [a.id, a.name]));
  const primaryCheckins = primaryGoal ? await getCheckins(primaryGoal.id) : [];
  const primarySummary = primaryGoal ? summarizeCheckins(primaryCheckins, primaryGoal) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <p className="label-caps text-sm text-gold">30-Day Command Centre</p>
      <h1 className="mt-2 font-heading text-2xl text-ink">My Goals</h1>

      <section className="mt-8 rounded-lg border border-gold bg-gold-soft p-5">
        <p className="label-caps text-xs text-gold-strong">Primary Focus</p>
        {primaryGoal ? (
          <>
            <p className="mt-1 font-heading text-lg text-ink">{nameById.get(primaryGoal.life_area_id)}</p>
            <p className="mt-2 text-base text-ink">{primaryGoal.action_text}</p>
            <p className="mt-1 text-sm text-ink-soft">{primaryGoal.motivation_text}</p>

            {primarySummary && (
              <div className="mt-4 flex gap-6">
                <div>
                  <p className="font-heading text-xl text-ink">{primarySummary.actionsDone}</p>
                  <p className="text-xs text-ink-faint">actions done</p>
                </div>
                <div>
                  <p className="font-heading text-xl text-ink">{primarySummary.streak}d</p>
                  <p className="text-xs text-ink-faint">streak</p>
                </div>
                <div>
                  <p className="font-heading text-xl text-ink">{primarySummary.completionRate}%</p>
                  <p className="text-xs text-ink-faint">completion</p>
                </div>
              </div>
            )}

            <Link
              href="/tracker"
              className="mt-4 inline-flex min-h-[var(--tap-target-min)] items-center rounded-md bg-gold px-6 font-body text-base font-medium text-gold-ink"
            >
              Open Tracker
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Your Primary Goal comes from finishing CLEAR for your Priority Focus.
            </p>
            <Link
              href="/clear"
              className="mt-4 inline-flex min-h-[var(--tap-target-min)] items-center rounded-md bg-gold px-6 font-body text-base font-medium text-gold-ink"
            >
              Start CLEAR
            </Link>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg text-ink">Supporting Goals ({supportingGoals.length}/2)</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your Primary Goal is your main focus — add supporting goals only if they help, not overwhelm.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {supportingGoals.map((goal) => (
            <div key={goal.id} className="rounded-lg border border-border bg-paper-raised p-4">
              <p className="label-caps text-xs text-gold-strong">{nameById.get(goal.life_area_id)}</p>
              <p className="mt-1 text-base text-ink">{goal.action_text}</p>
            </div>
          ))}

          <AddSupportingGoalClient
            lifeAreas={lifeAreas.map((a) => ({ id: a.id, name: a.name }))}
            slotsRemaining={2 - supportingGoals.length}
          />
        </div>
      </section>
    </main>
  );
}
