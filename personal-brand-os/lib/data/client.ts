import type { Database } from "@/lib/database.types";
import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

/**
 * A missing row here means one of two things — the id doesn't exist, or RLS
 * hid it because the signed-in user isn't assigned to this client. Either
 * way the right response is the same 404, never a distinguishing error
 * message (that would leak which client ids exist to someone without
 * access).
 */
export async function getClientById(supabase: Client, id: string): Promise<ClientRow | null> {
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface AssignedMember {
  userId: string;
  name: string;
  role: string;
}

/** §4 Client Overview's "Assigned team members" — who currently has
 * client_assignments access, resolved to display names. */
export async function getAssignedMembers(supabase: Client, clientId: string): Promise<AssignedMember[]> {
  const { data: assignments } = await supabase.from("client_assignments").select("user_id").eq("client_id", clientId);
  const userIds = (assignments ?? []).map((a) => a.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("id,full_name,email,role").in("id", userIds);
  return (profiles ?? []).map((p) => ({ userId: p.id, name: p.full_name || p.email, role: p.role }));
}

export interface TeamMemberOption {
  id: string;
  name: string;
  role: string;
}

export interface ClientActivityItem {
  id: string;
  tableName: string;
  action: string;
  changedByName: string;
  changedAt: string;
}

/** Per-client slice of the audit log (§24 Security) — admin-only, same as
 * the log itself; a non-admin querying this just gets nothing back via RLS. */
export async function getClientActivity(supabase: Client, clientId: string, limit = 10): Promise<ClientActivityItem[]> {
  const { data: events } = await supabase
    .from("audit_log")
    .select("id,table_name,action,changed_by,changed_at")
    .eq("client_id", clientId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  const rows = events ?? [];
  if (rows.length === 0) return [];

  const changerIds = [...new Set(rows.map((r) => r.changed_by).filter((id): id is string => id !== null))];
  const { data: profiles } = changerIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", changerIds)
    : { data: [] as { id: string; full_name: string; email: string }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    action: row.action,
    changedByName: row.changed_by ? (names.get(row.changed_by) ?? "Someone") : "System",
    changedAt: row.changed_at,
  }));
}

/** Every team member, for the admin-only "assign someone" picker — a small
 * roster, fetching them all is fine (RLS already lets anyone with a profile
 * read every profile, since names/roles are used for pickers/labels
 * throughout the app). */
export async function getAllTeamMembers(supabase: Client): Promise<TeamMemberOption[]> {
  const { data } = await supabase.from("profiles").select("id,full_name,email,role").order("full_name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email, role: p.role }));
}
