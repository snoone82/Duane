import { createClient } from "@/lib/supabase/server";
import { readPermissions } from "@/lib/client-team-permissions";
import type { Database } from "@/lib/database.types";

export type PortalClient = Database["public"]["Tables"]["clients"]["Row"];
type ClientMember = Database["public"]["Tables"]["client_members"]["Row"];

export interface PortalContext {
  client: PortalClient;
  /** Null for the principal portal client (clients.portal_user_id). */
  member: ClientMember | null;
  /** The principal sees the full portal; members are permission-gated. */
  can: (perm: string) => boolean;
  userId: string;
}

/**
 * Who is this portal user? Either the principal client
 * (clients.portal_user_id) or an active client-team member
 * (client_members.user_id). RLS scopes both lookups to exactly their own
 * client, so this can never resolve to someone else's.
 */
export async function getPortalContext(): Promise<PortalContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: principal } = await supabase.from("clients").select("*").eq("portal_user_id", user.id).maybeSingle();
  if (principal) {
    return { client: principal, member: null, can: () => true, userId: user.id };
  }

  const { data: membership } = await supabase
    .from("client_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const { data: client } = await supabase.from("clients").select("*").eq("id", membership.client_id).maybeSingle();
  if (!client) return null;

  const permissions = readPermissions(membership.permissions);
  return {
    client,
    member: membership,
    can: (perm: string) => permissions[perm] === true,
    userId: user.id,
  };
}

/** Back-compat helper for pages that only need the client row. */
export async function getPortalClient(): Promise<PortalClient | null> {
  const context = await getPortalContext();
  return context?.client ?? null;
}
