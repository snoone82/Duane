/**
 * Plain formatting helpers for Monthly Plans, kept out of
 * lib/actions/monthly-plans.ts deliberately: that file is "use server", which
 * makes every export a server action callable only via the RPC boundary
 * (async, serialisable args) — these are synchronous formatters used from
 * both server and client components.
 */

/** "October 2026" from a Monthly Plan's period_month date. */
export function periodMonthLabel(periodMonth: string): string {
  return new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "MC-01" style display numbering for a plan_sequence value. */
export function planSequenceLabel(n: number | null): string {
  return n === null ? "" : `MC-${String(n).padStart(2, "0")}`;
}

/** An account this client's own strategy has ruled out — never offered to
 * the AI as a destination, and a hard validation error on import if one
 * shows up there anyway. Shared between the export/import logic and the
 * pages that render a lead-platform picker, so both agree on what "excluded"
 * means. */
export function isPlatformExcluded(account: { account_status: string; publishing_enabled: boolean; cross_post_rule: string }): boolean {
  return account.account_status === "inactive" || !account.publishing_enabled || account.cross_post_rule === "never";
}

export function platformLabel(account: { platform: string; account_name: string }): string {
  return account.account_name ? `${account.platform} — ${account.account_name}` : account.platform;
}
