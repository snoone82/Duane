import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { SignoffSnapshotView } from "@/components/signoff/SignoffSnapshotView";
import { SignoffResponseForm } from "@/components/portal/SignoffResponseForm";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { isStrategySnapshot, signoffStatusMeta } from "@/lib/signoff-snapshot";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Sign-off" };

/** Duane's ask: deliberately simple. Version, date, status, a concise
 * summary of what's being approved, the two decisions — and the full
 * strategy tucked behind "View full strategy" instead of dominating the
 * page. History stays underneath. */
export default async function PortalSignoffPage() {
  const context = await getPortalContext();
  if (!context) return null;
  const canApprove = context.can("approve_strategy");

  const supabase = await createClient();
  // RLS: drafts never reach the portal.
  const { data: packs } = await supabase
    .from("strategy_signoffs")
    .select("*")
    .eq("client_id", context.client.id)
    .order("version", { ascending: false });

  const packList = packs ?? [];
  const [latest, ...earlier] = packList;
  const snapshot = latest && isStrategySnapshot(latest.snapshot) ? latest.snapshot : null;

  const summaryBits = snapshot
    ? [
        snapshot.audiences.length > 0 ? `${snapshot.audiences.length} audience${snapshot.audiences.length === 1 ? "" : "s"}` : null,
        snapshot.pillars.length > 0 ? `${snapshot.pillars.length} content pillar${snapshot.pillars.length === 1 ? "" : "s"}` : null,
        snapshot.platforms.length > 0 ? `${snapshot.platforms.length} platform plan${snapshot.platforms.length === 1 ? "" : "s"}` : null,
        snapshot.priorities.length > 0 ? `${snapshot.priorities.length} agreed priorit${snapshot.priorities.length === 1 ? "y" : "ies"}` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Your Personal Brand Strategy — review what&rsquo;s been agreed, approve it, or send it back with comments.
      </p>

      {!latest ? (
        <EmptyState
          title="Nothing to review yet"
          description="When the team shares your strategy pack, it will appear here for your approval."
        />
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  {latest.title} — Version {latest.version}
                </h2>
                <p className="mt-0.5 text-xs text-ink-faint">Updated {formatDate(latest.updated_at.slice(0, 10))}</p>
              </div>
              <StatusPill label={signoffStatusMeta(latest.status).label} color={signoffStatusMeta(latest.status).color} />
            </div>

            {snapshot && (
              <p className="mt-3 text-sm text-ink-soft">
                {snapshot.northStar ? (
                  <>
                    Built around your North Star — <span className="italic">&ldquo;{snapshot.northStar}&rdquo;</span>
                    {summaryBits.length > 0 ? <> — covering {summaryBits.join(", ")}.</> : "."}
                  </>
                ) : summaryBits.length > 0 ? (
                  <>This pack covers {summaryBits.join(", ")}.</>
                ) : null}
              </p>
            )}

            {latest.status === "approved" && (
              <p className="mt-3 text-sm text-success">
                Approved{latest.approved_by_name ? ` by ${latest.approved_by_name}` : ""} on{" "}
                {formatDate(latest.approved_at?.slice(0, 10))} — this is your agreed baseline.
              </p>
            )}
            {latest.status === "changes_requested" && (
              <p className="mt-3 text-sm text-ink-soft">
                You asked for changes — the team is on it. Your comments: &ldquo;{latest.client_comments}&rdquo;
              </p>
            )}

            {latest.status === "sent" &&
              (canApprove ? (
                <div className="mt-4 border-t border-border pt-3">
                  <SignoffResponseForm signoffId={latest.id} />
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-faint">
                  This pack is awaiting approval — approving strategy isn&rsquo;t enabled for your account.
                </p>
              ))}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <a
                href={`/api/signoff-pdf/${latest.id}`}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
              >
                Download PDF
              </a>
            </div>
          </section>

          <details className="group rounded-lg border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-ink">View full strategy</span>
              <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-border px-4 py-4">
              {snapshot ? (
                <SignoffSnapshotView snapshot={snapshot} />
              ) : (
                <p className="text-sm text-ink-faint">This pack can&rsquo;t be displayed — the team has been notified.</p>
              )}
            </div>
          </details>

          {earlier.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Sign-off history</h3>
              <ul className="space-y-1.5">
                {earlier.map((pack) => (
                  <li key={pack.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                      v{pack.version}
                      <StatusPill label={signoffStatusMeta(pack.status).label} color={signoffStatusMeta(pack.status).color} />
                      <span className="text-xs text-ink-faint">
                        {pack.status === "approved" && pack.approved_at
                          ? `approved ${formatDate(pack.approved_at.slice(0, 10))}${pack.approved_by_name ? ` by ${pack.approved_by_name}` : ""}`
                          : formatDate(pack.created_at.slice(0, 10))}
                      </span>
                    </span>
                    <a href={`/api/signoff-pdf/${pack.id}`} className="text-xs font-medium text-accent hover:underline">
                      PDF
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
