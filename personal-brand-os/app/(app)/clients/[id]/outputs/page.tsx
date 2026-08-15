import { createClient } from "@/lib/supabase/server";
import { CreateSignoffButton } from "@/components/signoff/CreateSignoffButton";
import { SignoffPackCard } from "@/components/signoff/SignoffPackCard";
import { SignoffSnapshotView } from "@/components/signoff/SignoffSnapshotView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isStrategySnapshot } from "@/lib/signoff-snapshot";

export const metadata = { title: "Outputs" };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Preset ranges for the performance report downloads. */
function reportPresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const quarterStartMonth = Math.floor(m / 3) * 3;
  return [
    { label: "This month", from: isoDate(new Date(Date.UTC(y, m, 1))), to: isoDate(now) },
    {
      label: "Last month",
      from: isoDate(new Date(Date.UTC(y, m - 1, 1))),
      to: isoDate(new Date(Date.UTC(y, m, 0))),
    },
    { label: "This quarter", from: isoDate(new Date(Date.UTC(y, quarterStartMonth, 1))), to: isoDate(now) },
    {
      label: "Last quarter",
      from: isoDate(new Date(Date.UTC(y, quarterStartMonth - 3, 1))),
      to: isoDate(new Date(Date.UTC(y, quarterStartMonth, 0))),
    },
  ];
}

export default async function OutputsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: packs } = await supabase
    .from("strategy_signoffs")
    .select("*")
    .eq("client_id", id)
    .order("version", { ascending: false });

  const packList = packs ?? [];
  const nextVersion = (packList[0]?.version ?? 0) + 1;

  return (
    <div className="max-w-4xl space-y-8">
      <section>
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Strategy sign-off</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Consultation → Populate OS → Client review → Sign-off → Execution. Creating a pack freezes the strategy
              as it stands right now; share it and the client approves it (or requests changes) from their portal.
            </p>
          </div>
          <CreateSignoffButton clientId={id} nextVersion={nextVersion} />
        </div>

        {packList.length === 0 ? (
          <EmptyState
            title="No sign-off packs yet"
            description="Once the strategy tabs are populated and refined, create v1 — review it here, then share it with the client for approval."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {packList.map((pack) => (
              <SignoffPackCard key={pack.id} clientId={id} pack={pack}>
                {isStrategySnapshot(pack.snapshot) ? (
                  <SignoffSnapshotView snapshot={pack.snapshot} />
                ) : (
                  <p className="text-sm text-ink-faint">This pack&rsquo;s snapshot can&rsquo;t be displayed.</p>
                )}
              </SignoffPackCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Performance reports</h2>
        <p className="mt-1 text-sm text-ink-soft">
          A branded PDF built from this client&rsquo;s data for the period — headline metrics, content performance,
          authority wins, commercial outcomes, milestones and what happens next.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {reportPresets().map((preset) => (
            <a
              key={preset.label}
              href={`/api/performance-pdf?clientId=${id}&from=${preset.from}&to=${preset.to}&label=${encodeURIComponent(preset.label)}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {preset.label} ↓
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
