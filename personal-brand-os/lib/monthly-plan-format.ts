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

// ---------------------------------------------------------------------------
// CTA destination state (Duane, after the first full run): the AI writes the
// literal "Needs confirmation" rather than inventing a URL, and that is a
// real state PBOS must keep — "not yet confirmed" is not the same thing as
// "nobody set one". Stored as the literal in cta_destination so it stays
// visible wherever the field is shown; read back through this helper.
// ---------------------------------------------------------------------------

export const CTA_NEEDS_CONFIRMATION = "Needs confirmation";

export type CtaDestinationState = "confirmed" | "needs_confirmation" | "missing" | "no_cta";

export function isCtaNeedsConfirmation(value: string): boolean {
  return value.trim().toLowerCase() === CTA_NEEDS_CONFIRMATION.toLowerCase();
}

/** Canonical spelling of the sentinel; anything else passes through. */
export function normaliseCtaDestination(value: string): string {
  return isCtaNeedsConfirmation(value) ? CTA_NEEDS_CONFIRMATION : value.trim();
}

export function ctaDestinationState(idea: { cta: string; cta_destination: string }): CtaDestinationState {
  if (!idea.cta.trim()) return "no_cta";
  const destination = idea.cta_destination.trim();
  if (!destination) return "missing";
  if (isCtaNeedsConfirmation(destination)) return "needs_confirmation";
  return "confirmed";
}

// ---------------------------------------------------------------------------
// Approval lock (Duane's three edit levels). Once a plan is approved its
// Master Content is the approved version of that month: direct edits and
// single-item regenerations become change requests on that item, and a whole
// -month regeneration becomes a numbered revision — never a silent overwrite.
// ---------------------------------------------------------------------------

export const LOCKED_PLAN_STATUSES = ["approved", "active", "closed"] as const;

export function isPlanLocked(status: string): boolean {
  return (LOCKED_PLAN_STATUSES as readonly string[]).includes(status);
}

/** Master Content fields a change request may target. */
export const CHANGE_REQUEST_FIELDS: { value: string; label: string; multiline: boolean }[] = [
  { value: "title", label: "Title", multiline: false },
  { value: "hook", label: "Hook", multiline: false },
  { value: "core_message", label: "Core message", multiline: true },
  { value: "purpose", label: "Purpose", multiline: true },
  { value: "cta", label: "CTA", multiline: false },
  { value: "cta_destination", label: "CTA destination", multiline: false },
  { value: "lead_draft_copy", label: "Lead draft copy", multiline: true },
  { value: "body", label: "Brief / body", multiline: true },
  { value: "notes", label: "Notes", multiline: true },
];
