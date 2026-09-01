import Link from "next/link";
import { cadenceLabel, platformRoleLabel, type CadenceState } from "@/lib/platform-strategy";
import { CADENCE_STAGES, type CadenceData } from "@/lib/data/cadence";

const STATE_STYLE: Record<CadenceState, { bar: string; note: string; text: string }> = {
  under: { bar: "bg-amber-500", note: "Below target", text: "text-amber-500" },
  on_track: { bar: "bg-success", note: "On target", text: "text-success" },
  over: { bar: "bg-accent", note: "Above target", text: "text-accent" },
  untracked: { bar: "bg-ink-faint/40", note: "", text: "text-ink-faint" },
};

/**
 * Planned-versus-target by platform for the current month.
 *
 * One component, one calculation (lib/data/cadence.ts), rendered on both the
 * admin Content tab and the client's own dashboard — Duane's condition for
 * putting it in front of clients at all: the two must never disagree.
 */
export function CadenceStrip({
  data,
  heading = "Cadence",
  emptyHref,
  emptyLabel,
  detailHref,
  detailLabel,
  showStages = false,
}: {
  data: CadenceData;
  heading?: string;
  /** Where to send someone when no targets are set (admin only). */
  emptyHref?: string;
  emptyLabel?: string;
  /** Where to go to see the actual posts behind the numbers. */
  detailHref?: string;
  detailLabel?: string;
  showStages?: boolean;
}) {
  if (data.accounts.length === 0) return null;
  const tracked = data.accounts.filter((row) => row.status.target !== null);

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
          {heading} · {data.monthLabel}
        </h2>
        {tracked.length === 0 && emptyHref ? (
          <Link href={emptyHref} className="text-xs text-accent underline-offset-2 hover:underline">
            {emptyLabel ?? "Set target cadences →"}
          </Link>
        ) : detailHref ? (
          <Link href={detailHref} className="text-xs text-accent underline-offset-2 hover:underline">
            {detailLabel ?? "See the posts →"}
          </Link>
        ) : null}
      </div>

      <ul className="space-y-3">
        {data.accounts.map((row) => {
          const style = STATE_STYLE[row.status.state];
          const pct = row.status.target ? Math.min(100, Math.round((row.status.planned / row.status.target) * 100)) : 0;
          const stageBits = CADENCE_STAGES.filter((s) => row.stages[s.key] > 0);
          return (
            <li key={row.account.id}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 text-sm text-ink">
                  {row.label}
                  {row.account.platform_role && (
                    <span className="ml-1.5 text-xs text-ink-faint">{platformRoleLabel(row.account.platform_role)}</span>
                  )}
                </span>
                <span className={`text-xs tabular-nums ${style.text}`}>
                  {row.status.label}
                  {style.note && ` · ${style.note}`}
                </span>
              </div>

              {row.status.target === null ? (
                <p className="text-xs text-ink-faint">{cadenceLabel(row.account)}</p>
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              )}

              {/* What those posts are actually doing — Duane's "what's planned
                  and what's ready to go out?" answered without opening a tab. */}
              {showStages && stageBits.length > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                  {stageBits.map((s) => (
                    <span key={s.key}>
                      <span className="tabular-nums text-ink-soft">{row.stages[s.key]}</span> {s.label.toLowerCase()}
                    </span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
