import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getActiveGoal,
  getAuditResponses,
  getCheckins,
  getCompletedAudits,
  getCurrentUser,
  getInProgressAudit,
  getLatestClearPlan,
  getLifeAreas,
  summarizeCheckins,
} from "@/lib/audit-data";
import { RadarChart } from "@/components/RadarChart";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { Logo } from "@/components/ui/Logo";
import { ScoreRing } from "@/components/ui/ScoreRing";

/**
 * The six-piece layout from the brief §5: Score, Alignment Chart, Priority
 * Focus, Current Aligned Goal, Progress, Next Action — answering "where am
 * I / what am I working on / am I improving / what should I do next?" in
 * that order. The Re-Audit trend (§4) rides along inside the Score section
 * rather than getting its own block, to keep it at six pieces, not seven.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const completedAudits = await getCompletedAudits(user.id);
  const completed = completedAudits.at(-1) ?? null;

  if (!completed) {
    const inProgress = await getInProgressAudit(user.id);
    redirect(inProgress ? "/audit" : "/");
  }

  const [lifeAreas, responses, clearPlan] = await Promise.all([
    getLifeAreas(),
    getAuditResponses(completed.id),
    getLatestClearPlan(user.id),
  ]);

  const nameById = new Map(lifeAreas.map((a) => [a.id, a.name]));
  const responseByAreaId = new Map(responses.map((r) => [r.life_area_id, r]));

  const orderedAreas = lifeAreas.map((area) => ({
    id: area.id,
    name: area.name,
    satisfaction: responseByAreaId.get(area.id)?.satisfaction_score ?? null,
  }));

  const radarPoints = orderedAreas
    .filter((a) => a.satisfaction !== null)
    .map((a) => ({ label: a.name, value: a.satisfaction as number }));

  const focusAreaId = completed.leverage_area_id;
  const focusAreaName = focusAreaId ? (nameById.get(focusAreaId) ?? null) : null;

  const primaryGoal = await getActiveGoal(user.id, "primary");
  const checkins = primaryGoal ? await getCheckins(primaryGoal.id) : [];
  const checkinSummary = primaryGoal ? summarizeCheckins(checkins, primaryGoal) : null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const checkedInToday = checkins.some((c) => c.checkin_date === todayKey);

  // Next Action: the single most obvious next step, in priority order.
  let nextAction: { text: string; href: string } | null = null;
  if (!clearPlan && focusAreaId) {
    nextAction = { text: `Start CLEAR for ${focusAreaName}`, href: "/clear" };
  } else if (clearPlan && clearPlan.status === "in_progress") {
    nextAction = { text: `Continue CLEAR — step ${clearPlan.current_step} of 5`, href: "/clear" };
  } else if (clearPlan && clearPlan.status === "completed" && !primaryGoal) {
    nextAction = { text: "Set your Aligned Goal", href: "/clear" };
  } else if (primaryGoal && !checkedInToday) {
    nextAction = { text: "Log today's check-in", href: "/tracker" };
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="inline-flex min-h-[var(--tap-target-min)] items-center px-3 text-sm text-ink-soft underline"
          >
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* 1. Life Alignment Score (+ Re-Audit trend, riding along) */}
      <div className="mt-10 text-center">
        <p className="label-caps text-sm text-ink-soft">Your Alignment Score</p>
        <div className="mt-4 flex justify-center">
          <ScoreRing value={completed.total_score ?? 0} max={100} size={128} />
        </div>
        <p className="mt-4 text-ink-faint">out of 100</p>

        {completedAudits.length > 1 && (
          <div className="mx-auto mt-6 flex max-w-xs flex-col gap-1.5">
            {completedAudits.map((audit, index) => (
              <div key={audit.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">
                  {audit.completed_at
                    ? new Date(audit.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    : `Audit ${index + 1}`}
                </span>
                <span
                  className={`font-heading ${
                    index === completedAudits.length - 1 ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {audit.total_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Alignment Chart */}
      <div className="mt-10">
        <RadarChart points={radarPoints} />
      </div>

      {/* 3. Priority Focus */}
      <section className="mt-10 rounded-lg border border-border bg-paper-raised p-5">
        <p className="label-caps text-xs text-gold-strong">Priority Focus</p>
        <p className="mt-1 font-heading text-lg text-ink">{focusAreaName ?? "Not chosen yet"}</p>
        <p className="mt-1 text-sm text-ink-soft">The area currently receiving attention.</p>
      </section>

      {/* 4. Current Aligned Goal */}
      <section className="mt-4 rounded-lg border border-border bg-paper-raised p-5">
        <p className="label-caps text-xs text-gold-strong">Current Aligned Goal</p>
        {primaryGoal ? (
          <>
            <p className="mt-1 font-heading text-lg text-ink">{primaryGoal.action_text}</p>
            <p className="mt-1 text-sm text-ink-soft">{primaryGoal.motivation_text}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">
            Not set yet — this comes from finishing CLEAR for your Priority Focus.
          </p>
        )}
      </section>

      {/* 5. Progress */}
      <section className="mt-4 rounded-lg border border-border bg-paper-raised p-5">
        <p className="label-caps text-xs text-gold-strong">Progress</p>
        {checkinSummary ? (
          <div className="mt-2 flex gap-6">
            <div>
              <p className="font-heading text-xl text-ink">{checkinSummary.actionsDone}</p>
              <p className="text-xs text-ink-faint">actions done</p>
            </div>
            <div>
              <p className="font-heading text-xl text-ink">{checkinSummary.streak}d</p>
              <p className="text-xs text-ink-faint">current streak</p>
            </div>
            <div>
              <p className="font-heading text-xl text-ink">{checkinSummary.completionRate}%</p>
              <p className="text-xs text-ink-faint">completion rate</p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Nothing tracked yet — this fills in once your goal is set.</p>
        )}
      </section>

      {/* 6. Next Action */}
      <section className="mt-4 mb-10 rounded-lg border border-gold bg-gold-soft p-5">
        <p className="label-caps text-xs text-gold-strong">Next Action</p>
        {nextAction ? (
          <>
            <p className="mt-1 font-heading text-lg text-ink">{nextAction.text}</p>
            <Link
              href={nextAction.href}
              className="mt-3 inline-flex min-h-[var(--tap-target-min)] items-center rounded-md bg-gold px-6 font-body text-base font-medium text-gold-ink"
            >
              Go
            </Link>
          </>
        ) : (
          <p className="mt-1 font-heading text-lg text-ink">
            You&apos;re checked in for today — nice work.
          </p>
        )}
      </section>

      <section className="mb-16 rounded-lg border border-border bg-paper-muted p-6">
        <h2 className="font-heading text-lg text-ink">What happens next</h2>
        <p className="mt-2 text-base leading-normal text-ink-soft">
          Duane personally reads every completed audit — yours included. He&apos;ll
          look at where you are across all ten areas, think about what&apos;s
          really going to move the needle, and reach out with what he sees.
        </p>
      </section>
    </main>
  );
}
