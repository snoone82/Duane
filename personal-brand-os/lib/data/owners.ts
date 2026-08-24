import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { OwnerOption } from "@/components/clients/ActionEditor";

type Client = SupabaseServerClient;

const TEAM_GROUP = "Aligned Media";

/** Duane's Part E: inside a client, the owner dropdown shows two logical
 * groups — the Aligned Media team, and THIS client's team members only.
 * Charlie is assignable inside Daniel Andrews and simply doesn't exist in
 * any other client's dropdown. */
export async function getOwnerOptions(supabase: Client, clientId: string): Promise<OwnerOption[]> {
  const [{ data: team }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .in("role", ["admin", "member", "contractor"])
      .order("full_name"),
    supabase
      .from("client_members")
      .select("id,name,user_id,status,can_be_assigned")
      .eq("client_id", clientId)
      .neq("status", "disabled")
      .order("created_at"),
  ]);

  const options: OwnerOption[] = (team ?? []).map((p) => ({
    value: `u:${p.id}`,
    label: p.full_name || p.email,
    group: TEAM_GROUP,
  }));
  for (const member of members ?? []) {
    if (!member.can_be_assigned) continue;
    options.push({
      value: member.user_id ? `u:${member.user_id}` : `n:${member.name}`,
      label: member.name,
      group: "Client team",
    });
  }
  return options;
}

/** The global Actions page shows every client at once, so each row needs the
 * dropdown for ITS client. One query, grouped — RLS scopes the membership
 * rows to clients the caller can access. */
export async function getOwnerOptionsByClient(supabase: Client): Promise<Map<string, OwnerOption[]>> {
  const [{ data: team }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .in("role", ["admin", "member", "contractor"])
      .order("full_name"),
    supabase
      .from("client_members")
      .select("id,client_id,name,user_id,status,can_be_assigned")
      .neq("status", "disabled")
      .order("created_at"),
  ]);

  const teamOptions: OwnerOption[] = (team ?? []).map((p) => ({
    value: `u:${p.id}`,
    label: p.full_name || p.email,
    group: TEAM_GROUP,
  }));

  const byClient = new Map<string, OwnerOption[]>();
  for (const member of members ?? []) {
    if (!member.can_be_assigned) continue;
    const list = byClient.get(member.client_id) ?? [...teamOptions];
    list.push({
      value: member.user_id ? `u:${member.user_id}` : `n:${member.name}`,
      label: member.name,
      group: "Client team",
    });
    byClient.set(member.client_id, list);
  }
  // Clients with no members still need the team group.
  byClient.set("", teamOptions);
  return byClient;
}
