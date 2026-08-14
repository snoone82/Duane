import Link from "next/link";
import { getActiveGoal, getCheckins, getCurrentUser, getLifeAreas } from "@/lib/audit-data";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { Logo } from "@/components/ui/Logo";
import { TrackerCheckinClient } from "@/components/tracker/TrackerCheckinClient";

/**
 * Tied directly to the active primary goal, per brief §9 ("connect
 * directly to the active goal rather than being a separate feature") — no
 * goal, no tracker. Supporting goals don't get a tracker view yet; this
 * only covers the one thing the Dashboard's Progress section reads from.
 */
export default async function TrackerPage() {
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const goal = await getActiveGoal(user.id, "primary");
  if (!goal) {
    return (
      <SessionNotice message="There's no active goal to track yet — set your Aligned Goal in CLEAR first." />
    );
  }

  const [checkins, lifeAreas] = await Promise.all([getCheckins(goal.id), getLifeAreas()]);
  const areaName = lifeAreas.find((a) => a.id === goal.life_area_id)?.name ?? "";

  const todayKey = new Date().toISOString().slice(0, 10);
  const byDate = new Map(checkins.map((c) => [c.checkin_date, c]));
  const todayEntry = byDate.get(todayKey) ?? null;

  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <Link href="/goals" className="text-sm text-ink-soft">
        ← My Goals
      </Link>

      <p className="label-caps mt-4 text-sm text-gold">30-Day Tracker</p>
      <h1 className="mt-2 font-heading text-2xl text-ink">{goal.action_text}</h1>
      <p className="mt-1 text-sm text-ink-soft">{areaName}</p>

      <div className="mt-8">
        <TrackerCheckinClient
          goalId={goal.id}
          todayKey={todayKey}
          existing={
            todayEntry
              ? {
                  actionCompleted: todayEntry.action_completed,
                  confidenceScore: todayEntry.confidence_score,
                  selfTrustScore: todayEntry.self_trust_score,
                  note: todayEntry.note,
                }
              : null
          }
        />
      </div>

      <section className="mt-10 mb-16">
        <h2 className="font-heading text-lg text-ink">Recent entries</h2>
        <div className="mt-4 flex flex-col gap-2">
          {recentDays.map((dateKey) => {
            const entry = byDate.get(dateKey);
            const label = new Date(dateKey + "T00:00:00Z").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return (
              <div
                key={dateKey}
                className="flex items-center justify-between rounded-md border border-border bg-paper-raised px-4 py-3"
              >
                <span className="text-sm text-ink">{label}</span>
                <span className="text-sm text-ink-faint">
                  {entry ? (entry.action_completed ? "Done" : "Not done") : "Not logged"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
