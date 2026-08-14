import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

/**
 * Every query in lib/data/ relies entirely on RLS to scope results to what
 * the signed-in user can see (has_client_access()) — there is no separate
 * "which clients am I allowed to query" filter anywhere in this file. That's
 * deliberate: it's the same mechanism acceptance test 9 exercises, so the
 * dashboard, search and every list page automatically respect a team
 * member's assignment without each query re-implementing the rule.
 */

export async function getClientsMap(supabase: Client): Promise<Map<string, string>> {
  const { data } = await supabase.from("clients").select("id,name");
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

export async function getProfilesMap(supabase: Client): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("id,full_name,email");
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

export function ownerLabel(
  action: { owner_user_id: string | null; owner_name: string | null },
  profiles: Map<string, string>
): string {
  if (action.owner_user_id) return profiles.get(action.owner_user_id) ?? "Unknown";
  return action.owner_name ?? "Unassigned";
}
