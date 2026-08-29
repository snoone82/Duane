/** The configurable client-team permissions (Duane Part B). Stored as
 * boolean flags in client_members.permissions jsonb; absent = false. The
 * principal portal client (clients.portal_user_id) bypasses all of these —
 * see portal_can() in migration 0018.
 *
 * DB-enforced (RLS/policies): approve_strategy, approve_content,
 * view_meetings, view_actions, manage_actions, connect_social. The remaining view_* flags
 * gate which portal tabs render; the underlying reads are still strictly
 * scoped to the member's own client by RLS. */
export const CLIENT_PERMISSIONS = [
  { key: "view_strategy", label: "View approved strategy" },
  { key: "approve_strategy", label: "Approve strategy sign-offs" },
  { key: "view_content", label: "View content" },
  { key: "approve_content", label: "Approve content" },
  { key: "view_actions", label: "See client-visible actions (beyond their own)" },
  { key: "manage_actions", label: "Update client-visible actions (beyond their own)" },
  { key: "view_progress", label: "View progress & milestones" },
  { key: "view_meetings", label: "View meeting summaries" },
  { key: "connect_social", label: "Connect social accounts" },
] as const;

export type ClientPermissionKey = (typeof CLIENT_PERMISSIONS)[number]["key"];

/** Sensible starting point for a new member: they can see and work, but
 * approvals and meetings stay off until deliberately granted. */
export const DEFAULT_MEMBER_PERMISSIONS: Record<ClientPermissionKey, boolean> = {
  view_strategy: true,
  approve_strategy: false,
  view_content: true,
  approve_content: false,
  view_actions: true,
  manage_actions: true,
  view_progress: true,
  view_meetings: false,
  // Linking a brand's social accounts is a significant act — off until
  // deliberately granted. The principal client bypasses this, as with every
  // portal_can check.
  connect_social: false,
};

export function readPermissions(raw: unknown): Record<string, boolean> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = value === true;
  }
  return out;
}
