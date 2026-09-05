import type { ActionStatus, AuthorityStatus, ClientStatus, ContentPriority, ContentStatus } from "@/lib/enums";

export type TagColor =
  | "slate"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "purple"
  | "pink"
  | "red";

/** Ordered pipeline + label + tag colour for every status field in the app.
 * Kept in one place so a table row and its status dropdown always agree on
 * label text and never drift from the database enum. */

export const CLIENT_STATUS: { value: ClientStatus; label: string; color: TagColor }[] = [
  { value: "prospect", label: "Prospect", color: "slate" },
  { value: "active", label: "Active", color: "green" },
  { value: "paused", label: "Paused", color: "amber" },
  { value: "offboarded", label: "Offboarded", color: "red" },
];

/** The production pipeline (Duane's workflow): Idea → Approved for
 * production → In production → Ready for approval → (Changes requested) →
 * Ready to schedule → Scheduled → Published. The old single-word statuses
 * (approved/drafted/created/edited/measured) still exist in the DB enum but
 * were migrated off in 0013 and are no longer offered. */
export const CONTENT_STATUS: { value: ContentStatus; label: string; color: TagColor }[] = [
  { value: "idea", label: "Idea", color: "slate" },
  { value: "approved_production", label: "Approved for production", color: "blue" },
  { value: "in_production", label: "In production", color: "cyan" },
  { value: "ready_for_approval", label: "Ready for approval", color: "purple" },
  { value: "changes_requested", label: "Changes requested", color: "red" },
  { value: "ready_to_schedule", label: "Ready to schedule", color: "orange" },
  { value: "scheduled", label: "Scheduled", color: "amber" },
  { value: "published", label: "Published", color: "green" },
];

export type OutputStatus = "pending" | "scheduled" | "published";

export const OUTPUT_STATUS: { value: OutputStatus; label: string; color: TagColor }[] = [
  { value: "pending", label: "Not scheduled", color: "slate" },
  { value: "scheduled", label: "Scheduled", color: "amber" },
  { value: "published", label: "Published", color: "green" },
];

export const AUTHORITY_STATUS: { value: AuthorityStatus; label: string; color: TagColor }[] = [
  { value: "identified", label: "Identified", color: "slate" },
  { value: "pitched", label: "Pitched", color: "blue" },
  { value: "in_conversation", label: "In conversation", color: "amber" },
  { value: "booked", label: "Booked", color: "purple" },
  { value: "completed", label: "Completed", color: "teal" },
  { value: "published", label: "Published", color: "green" },
  { value: "declined", label: "Declined", color: "red" },
];

export const ACTION_STATUS: { value: ActionStatus; label: string; color: TagColor }[] = [
  { value: "not_started", label: "Not Started", color: "slate" },
  { value: "in_progress", label: "In Progress", color: "blue" },
  { value: "waiting", label: "Waiting", color: "amber" },
  { value: "completed", label: "Completed", color: "green" },
];

export const CONTENT_PRIORITY: { value: ContentPriority; label: string; color: TagColor }[] = [
  { value: "low", label: "Low", color: "slate" },
  { value: "medium", label: "Medium", color: "amber" },
  { value: "high", label: "High", color: "red" },
];

// --- Actions as the master task layer (Duane batch 6) ---

export type ActionPriority = "low" | "medium" | "high";
export type ActionVisibility = "internal" | "client";

export const ACTION_PRIORITY: { value: ActionPriority; label: string; color: TagColor }[] = [
  { value: "low", label: "Low", color: "slate" },
  { value: "medium", label: "Medium", color: "amber" },
  { value: "high", label: "High", color: "red" },
];

export const ACTION_VISIBILITY: { value: ActionVisibility; label: string; color: TagColor }[] = [
  { value: "internal", label: "Internal (Aligned Media)", color: "slate" },
  { value: "client", label: "Client visible", color: "teal" },
];

// --- Monthly Plan (Duane, 5 Sep 2026 — the structured planning layer) ---
// Check-constrained text columns, not real Postgres enums (see migration
// 0032), so — like ActionPriority/ActionVisibility above — the literal
// unions live here rather than as Database["public"]["Enums"] aliases.

export type MonthlyPlanStatus = "planning" | "in_review" | "approved" | "active" | "closed";

export const MONTHLY_PLAN_STATUS: { value: MonthlyPlanStatus; label: string; color: TagColor }[] = [
  { value: "planning", label: "Planning", color: "slate" },
  { value: "in_review", label: "In review", color: "amber" },
  { value: "approved", label: "Approved", color: "blue" },
  { value: "active", label: "Active", color: "green" },
  { value: "closed", label: "Closed", color: "purple" },
];

/** Who proposed a piece of Master Content / a Platform Output — never a
 * status, purely what badges it as AI-proposed vs. a portal client's own
 * submission vs. typed in by hand. */
export type ContentOrigin = "manual" | "client" | "ai_import";

export const CONTENT_ORIGIN: { value: ContentOrigin; label: string; color: TagColor }[] = [
  { value: "manual", label: "Manual", color: "slate" },
  { value: "client", label: "Client", color: "teal" },
  { value: "ai_import", label: "AI import", color: "purple" },
];

export type RequirementType = "filming" | "asset_upload" | "information" | "decision_approval" | "access" | "other";

export const REQUIREMENT_TYPE: { value: RequirementType; label: string; color: TagColor }[] = [
  { value: "filming", label: "Filming", color: "cyan" },
  { value: "asset_upload", label: "Asset upload", color: "blue" },
  { value: "information", label: "Information", color: "slate" },
  { value: "decision_approval", label: "Decision / approval", color: "purple" },
  { value: "access", label: "Access", color: "orange" },
  { value: "other", label: "Other", color: "slate" },
];

export type RequirementState = "open" | "needs_confirmation" | "received" | "done";

export const REQUIREMENT_STATE: { value: RequirementState; label: string; color: TagColor }[] = [
  { value: "open", label: "Open", color: "amber" },
  { value: "needs_confirmation", label: "Needs confirmation", color: "orange" },
  { value: "received", label: "Received", color: "blue" },
  { value: "done", label: "Done", color: "green" },
];

/** Who or what raised a requirement (migration 0033). system_generated ones
 * are PBOS's own — computed from the plan's actual Master Content / Platform
 * Outputs (an aggregate filming count, a missing CTA destination, an
 * off-cadence platform) and recomputed on demand, never left stale once the
 * underlying condition clears. */
export type RequirementOrigin = "manual" | "ai_import" | "system_generated";

export const REQUIREMENT_ORIGIN: { value: RequirementOrigin; label: string; color: TagColor }[] = [
  { value: "manual", label: "Manual", color: "slate" },
  { value: "ai_import", label: "AI import", color: "purple" },
  { value: "system_generated", label: "Auto-generated", color: "cyan" },
];

export const monthlyPlanStatusMeta = (value: string) => lookup(MONTHLY_PLAN_STATUS, value as MonthlyPlanStatus);
export const contentOriginMeta = (value: string) => lookup(CONTENT_ORIGIN, value as ContentOrigin);
export const requirementTypeMeta = (value: string) => lookup(REQUIREMENT_TYPE, value as RequirementType);
export const requirementOriginMeta = (value: string) => lookup(REQUIREMENT_ORIGIN, value as RequirementOrigin);
export const requirementStateMeta = (value: string) => lookup(REQUIREMENT_STATE, value as RequirementState);

/** Duane's sales pipeline stages, in journey order. Won/lost are terminal. */
export type SalesStage =
  | "prospect"
  | "contacted"
  | "conversation"
  | "qualified"
  | "consultation"
  | "proposal"
  | "decision"
  | "won"
  | "lost";

export const SALES_STAGES: { value: SalesStage; label: string; color: TagColor }[] = [
  { value: "prospect", label: "Prospect", color: "slate" },
  { value: "contacted", label: "Contacted", color: "blue" },
  { value: "conversation", label: "Conversation", color: "cyan" },
  { value: "qualified", label: "Qualified", color: "teal" },
  { value: "consultation", label: "Consultation", color: "purple" },
  { value: "proposal", label: "Proposal", color: "orange" },
  { value: "decision", label: "Decision", color: "amber" },
  { value: "won", label: "Won", color: "green" },
  { value: "lost", label: "Lost", color: "red" },
];

export const salesStageMeta = (value: string) => lookup(SALES_STAGES, value as SalesStage);

/** Where an Action originated — set automatically, shown read-only. */
export const ACTION_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  meeting: "Meeting / Consultation",
  opportunity: "Authority Opportunity",
  content: "Content workflow",
  import: "AI Import",
  client_confirmation: "AI / Client Confirmation",
  signoff: "Strategy Sign-off",
  system: "System",
};

function lookup<V extends string>(
  list: { value: V; label: string; color: TagColor }[],
  value: V
) {
  return list.find((item) => item.value === value) ?? list[0]!;
}

export const clientStatusMeta = (value: ClientStatus) => lookup(CLIENT_STATUS, value);
export const contentStatusMeta = (value: ContentStatus) => lookup(CONTENT_STATUS, value);
export const authorityStatusMeta = (value: AuthorityStatus) => lookup(AUTHORITY_STATUS, value);
export const actionStatusMeta = (value: ActionStatus) => lookup(ACTION_STATUS, value);
export const actionPriorityMeta = (value: string) => lookup(ACTION_PRIORITY, value as ActionPriority);
export const contentPriorityMeta = (value: ContentPriority) => lookup(CONTENT_PRIORITY, value);
export const outputStatusMeta = (value: OutputStatus) => lookup(OUTPUT_STATUS, value);
