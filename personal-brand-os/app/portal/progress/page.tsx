import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { PortalCard } from "@/components/portal/ReadOnlyField";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Progress" };

export default async function PortalProgressPage() {
  const client = await getPortalClient();
  if (!client) return null;

  const supabase = await createClient();
  const [{ data: snapshots }, { data: targets }, { data: milestones }] = await Promise.all([
    supabase
      .from("metric_snapshots")
      .select("*")
      .eq("client_id", client.id)
      .order("snapshot_date", { ascending: false }),
    supabase.from("metric_targets").select("*").eq("client_id", client.id).order("platform"),
    supabase
      .from("milestones")
      .select("*")
      .eq("client_id", client.id)
      .order("milestone_date", { ascending: false })
      .limit(20),
  ]);

  // Latest snapshot per platform (rows arrive newest-first).
  const latestByPlatform = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snap of snapshots ?? []) {
    if (!latestByPlatform.has(snap.platform)) latestByPlatform.set(snap.platform, snap);
  }
  const platforms = [...latestByPlatform.values()];

  const hasAnything = platforms.length > 0 || (milestones?.length ?? 0) > 0;

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-ink-soft">How your brand is growing — audience numbers and the milestones along the way.</p>

      {!hasAnything && (
        <EmptyState title="No progress data yet" description="Audience numbers and milestones will appear here as the team logs them." />
      )}

      {platforms.length > 0 && (
        <PortalCard title="Audience">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {platforms.map((snap) => {
              const target = (targets ?? []).find((t) => t.platform === snap.platform);
              return (
                <div key={snap.platform} className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{snap.platform}</p>
                  <p className="mt-1 text-xl font-semibold text-ink">{formatNumber(snap.followers)}</p>
                  <p className="text-xs text-ink-faint">
                    followers as of {formatDate(snap.snapshot_date)}
                    {target?.target_value ? ` · target ${formatNumber(target.target_value)}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </PortalCard>
      )}

      {milestones && milestones.length > 0 && (
        <PortalCard title="Milestones">
          <ol className="space-y-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-ink">{milestone.title}</p>
                  <p className="text-xs text-ink-faint">{formatDate(milestone.milestone_date)}</p>
                  {milestone.description.trim() && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{milestone.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </PortalCard>
      )}
    </div>
  );
}
