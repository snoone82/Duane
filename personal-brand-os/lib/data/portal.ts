import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type PortalClient = Database["public"]["Tables"]["clients"]["Row"];

/**
 * The client record linked to the signed-in portal user (clients.portal_user_id),
 * or null if this account isn't linked to one. RLS already scopes a
 * client-role user's SELECT on clients to exactly their own row, so this can
 * never return someone else's client.
 */
export async function getPortalClient(): Promise<PortalClient | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("clients").select("*").eq("portal_user_id", user.id).maybeSingle();
  return data;
}
