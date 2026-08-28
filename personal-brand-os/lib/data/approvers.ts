import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

export interface ApproverOption {
  id: string;
  name: string;
  /** "Aligned Media" or "Client team" — the dropdown's optgroup. */
  group: string;
}

const TEAM_GROUP = "Aligned Media";
const CLIENT_GROUP = "Client team";

/**
 * Who may be set as the approver on this client's content.
 *
 * Duane's workflow: internal review → ready for client approval → the
 * assigned client approver decides. So the list is the Aligned Media team
 * plus this client's own people — the principal portal account and any
 * client-team member who has a login and the approve-content permission.
 *
 * Client-side approvers are strictly per client: a CEG team member appears
 * on Daniel's content and nowhere else, because the only bridge is that
 * client's own membership rows.
 */
export async function getApproverOptions(supabase: Client, clientId: string): Promise<ApproverOption[]> {
  const [{ data: team }, { data: client }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .in("role", ["admin", "member", "contractor"])
      .order("full_name", { ascending: true }),
    supabase.from("clients").select("id,name,portal_user_id").eq("id", clientId).maybeSingle(),
    supabase
      .from("client_members")
      .select("name,user_id,status,permissions")
      .eq("client_id", clientId)
      .eq("status", "active"),
  ]);

  const options: ApproverOption[] = (team ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email,
    group: TEAM_GROUP,
  }));

  const seen = new Set(options.map((o) => o.id));

  // The client themselves — the principal portal account always approves.
  if (client?.portal_user_id && !seen.has(client.portal_user_id)) {
    const { data: principal } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", client.portal_user_id)
      .maybeSingle();
    options.push({
      id: client.portal_user_id,
      name: principal?.full_name || principal?.email || client.name,
      group: CLIENT_GROUP,
    });
    seen.add(client.portal_user_id);
  }

  // Client-team members who can actually act: a linked login plus the
  // approve_content permission.
  for (const member of members ?? []) {
    if (!member.user_id || seen.has(member.user_id)) continue;
    const permissions = member.permissions;
    const canApprove =
      typeof permissions === "object" &&
      permissions !== null &&
      !Array.isArray(permissions) &&
      (permissions as Record<string, unknown>).approve_content === true;
    if (!canApprove) continue;
    options.push({ id: member.user_id, name: member.name, group: CLIENT_GROUP });
    seen.add(member.user_id);
  }

  return options;
}
