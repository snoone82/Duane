import Link from "next/link";
import { cadenceStatus, cadenceLabel, platformRoleLabel, type CadenceState } from "@/lib/platform-strategy";
import { socialAccountLabel } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type SocialStrategy = Database["public"]["Tables"]["social_strategies"]["Row"];

const STATE_STYLE: Record<CadenceState, { bar: string; note: string; text: string }> = {
  under: { bar: "bg-amber-500", note: "Below target", text: "text-amber-500" },
  on_track: { bar: "bg-success", note: "On track", text: "text-success" },
  over: { bar: "bg-accent", note: "Above target", text: "text-accent" },
  untracked: { bar: "bg-ink-faint/40", note: "", text: "text-ink-faint" },
};

export interface PlannedCount {
  accountId: string;
  planned: number;
}

/**
 * Planned-versus-target by platform for the current month (Duane's brief,
 * acceptance criterion 7). Accounts with no cadence target are listed but
 * not judged — a blank target means "not tracked", never "zero wanted".
 */
export function CadenceStrip({
  clientId,
  accounts,
  planned,
  monthLabel,
}: {
  clientId: string;
  accounts: SocialStrategy[];
  planned: Map<string, number>;
  monthLabel: string;
}) {
  const live = accounts.filter((account) => account.account_status !== "inactive");
  if (live.length === 0) return null;

  const tracked = live.filter((account) => account.cadence_target > 0);

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Cadence · {monthLabel}</h2>
        {tracked.length === 0 && (
          <Link href={`/clients/${clientId}/social`} className="text-xs text-accent underline-offset-2 hover:underline">
            Set target cadences on the Social tab →
          </Link>
        )}
      </div>

      <ul className="space-y-2.5">
        {live.map((account) => {
          const status = cadenceStatus(account, planned.get(account.id) ?? 0);
          const style = STATE_STYLE[status.state];
          const pct = status.target ? Math.min(100, Math.round((status.planned / status.target) * 100)) : 0;
          return (
            <li key={account.id}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 text-sm text-ink">
                  {socialAccountLabel(account.platform, account.account_name)}
                  {account.platform_role && (
                    <span className="ml-1.5 text-xs text-ink-faint">{platformRoleLabel(account.platform_role)}</span>
                  )}
                </span>
                <span className={`text-xs tabular-nums ${style.text}`}>
                  {status.label}
                  {style.note && ` · ${style.note}`}
                </span>
              </div>
              {status.target === null ? (
                <p className="text-xs text-ink-faint">{cadenceLabel(account)}</p>
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
