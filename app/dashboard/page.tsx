import { redirect } from "next/navigation";
import {
  getAuditResponses,
  getCurrentUser,
  getInProgressAudit,
  getLatestCompletedAudit,
  getLifeAreas,
} from "@/lib/audit-data";
import { RadarChart } from "@/components/RadarChart";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { Logo } from "@/components/ui/Logo";
import { ScoreRing } from "@/components/ui/ScoreRing";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const completed = await getLatestCompletedAudit(user.id);

  if (!completed) {
    const inProgress = await getInProgressAudit(user.id);
    redirect(inProgress ? "/audit" : "/");
  }

  const [lifeAreas, responses] = await Promise.all([
    getLifeAreas(),
    getAuditResponses(completed.id),
  ]);

  const responseByAreaId = new Map(responses.map((r) => [r.life_area_id, r]));

  const orderedAreas = lifeAreas.map((area) => ({
    id: area.id,
    name: area.name,
    satisfaction: responseByAreaId.get(area.id)?.satisfaction_score ?? null,
  }));

  const radarPoints = orderedAreas
    .filter((a) => a.satisfaction !== null)
    .map((a) => ({ label: a.name, value: a.satisfaction as number }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <SignOutButton />
      </div>

      <div className="mt-10 text-center">
        <p className="label-caps text-sm text-ink-soft">Your Alignment Score</p>
        <div className="mt-4 flex justify-center">
          <ScoreRing value={completed.total_score ?? 0} max={100} size={128} />
        </div>
        <p className="mt-4 text-ink-faint">out of 100</p>
      </div>

      <div className="mt-10">
        <RadarChart points={radarPoints} />
      </div>

      <section className="mt-10">
        <h2 className="font-heading text-xl text-ink">Your areas</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {orderedAreas.map((area) => (
            <li
              key={area.id}
              className="flex items-center justify-between rounded-md border border-border bg-paper-raised px-4 py-3"
            >
              <span className="text-base text-ink">{area.name}</span>
              <span className="font-heading text-lg text-ink">
                {area.satisfaction ?? "—"}
                <span className="text-sm text-ink-faint">/10</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 mb-16 rounded-lg border border-border bg-paper-muted p-6">
        <h2 className="font-heading text-lg text-ink">What happens next</h2>
        <p className="mt-2 text-base leading-normal text-ink-soft">
          Duane personally reads every completed audit — yours included. He&apos;ll
          look at where you are across all ten areas, think about what&apos;s
          really going to move the needle, and reach out with what he sees.
          There&apos;s nothing else for you to do right now.
        </p>
      </section>
    </main>
  );
}
