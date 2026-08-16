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
export const contentPriorityMeta = (value: ContentPriority) => lookup(CONTENT_PRIORITY, value);
export const outputStatusMeta = (value: OutputStatus) => lookup(OUTPUT_STATUS, value);
