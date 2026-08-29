import { createClient } from "@/lib/supabase/server";
import { readPermissions } from "@/lib/client-team-permissions";
import { getPreviewUserId } from "@/lib/preview";
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
  /** Set when an admin is viewing this portal as someone else. Everything
   * is read-only while it is — see lib/preview.ts. */
  preview: { name: string; isPrincipal: boolean } | null;
}

/**
 * An admin viewing the portal as one of a client's users (Duane's read-only
 * View as User). The admin's own session and RLS are unchanged — only the
 * permission set and the client being rendered come from the target user,
 * which is exactly "render the app using their permissions" rather than
 * "act as them".
 */
async function buildPreviewContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  previewUserId: string
): Promise<PortalContext | null> {
  // Principal first: their portal is ungated, like a real principal's.
  const { data: principal } = await supabase.from("clients").select("*").eq("portal_user_id", previewUserId).maybeSingle();
  if (principal) {
    const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", previewUserId).maybeSingle();
    return {
      client: principal,
      member: null,
      can: () => true,
      userId: previewUserId,
      preview: { name: profile?.full_name || profile?.email || principal.name, isPrincipal: true },
    };
  }

  const { data: membership } = await supabase
    .from("client_members")
    .select("*")
    .eq("user_id", previewUserId)
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
    userId: previewUserId,
    preview: { name: membership.name, isPrincipal: false },
  };
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

  // View as User: admins only, and only ever read-only. A non-admin with the
  // cookie set gets their own portal, never someone else's.
  const previewUserId = await getPreviewUserId();
  if (previewUserId && previewUserId !== user.id) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role === "admin") {
      const previewContext = await buildPreviewContext(supabase, previewUserId);
      if (previewContext) return previewContext;
    }
  }

  const { data: principal } = await supabase.from("clients").select("*").eq("portal_user_id", user.id).maybeSingle();
  if (principal) {
    return { client: principal, member: null, can: () => true, userId: user.id, preview: null };
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
    preview: null,
  };
}

/** Back-compat helper for pages that only need the client row. */
export async function getPortalClient(): Promise<PortalClient | null> {
  const context = await getPortalContext();
  return context?.client ?? null;
}
