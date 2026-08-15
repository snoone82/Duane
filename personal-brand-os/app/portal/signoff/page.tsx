import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { SignoffSnapshotView } from "@/components/signoff/SignoffSnapshotView";
import { SignoffResponseForm } from "@/components/portal/SignoffResponseForm";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { isStrategySnapshot, signoffStatusMeta } from "@/lib/signoff-snapshot";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Sign-off" };

export default async function PortalSignoffPage() {
  const client = await getPortalClient();
  if (!client) return null;

  const supabase = await createClient();
  // RLS: drafts never reach the portal.
  const { data: packs } = await supabase
    .from("strategy_signoffs")
    .select("*")
    .eq("client_id", client.id)
    .order("version", { ascending: false });

  const packList = packs ?? [];
  const [latest, ...earlier] = packList;

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-ink">
                {latest.title} — v{latest.version}
              </h2>
              <StatusPill label={signoffStatusMeta(latest.status).label} color={signoffStatusMeta(latest.status).color} />
            </div>
            <a
              href={`/api/signoff-pdf/${latest.id}`}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
            >
              Download PDF
            </a>
          </div>

          {latest.status === "approved" && (
            <p className="text-sm text-success">
              Approved{latest.approved_by_name ? ` by ${latest.approved_by_name}` : ""} on{" "}
              {formatDate(latest.approved_at?.slice(0, 10))} — this is your agreed baseline.
            </p>
          )}
          {latest.status === "changes_requested" && (
            <p className="text-sm text-ink-soft">
              You asked for changes — the team is on it. Your comments: &ldquo;{latest.client_comments}&rdquo;
            </p>
          )}

          <div className="rounded-lg border border-border bg-surface p-4">
            {isStrategySnapshot(latest.snapshot) ? (
              <SignoffSnapshotView snapshot={latest.snapshot} />
            ) : (
              <p className="text-sm text-ink-faint">This pack can&rsquo;t be displayed — the team has been notified.</p>
            )}
          </div>

          {latest.status === "sent" && <SignoffResponseForm signoffId={latest.id} />}

          {earlier.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Earlier versions</h3>
              <ul className="space-y-1.5">
                {earlier.map((pack) => (
                  <li key={pack.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
                    <span className="flex items-center gap-3 text-sm text-ink-soft">
                      v{pack.version}
                      <StatusPill label={signoffStatusMeta(pack.status).label} color={signoffStatusMeta(pack.status).color} />
                      <span className="text-xs text-ink-faint">{formatDate(pack.created_at.slice(0, 10))}</span>
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
