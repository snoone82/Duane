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
