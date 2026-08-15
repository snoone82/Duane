"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";

/** Link (or unlink, with null) a client-role account to a client record so
 * that account sees this client's portal. Admin-only — RLS would let any
 * assigned member update clients, but who gets portal access is an
 * admin decision. */
export async function setPortalUser(clientId: string, userId: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can manage portal access." };

  return runAction(async () => {
    const supabase = await createClient();

    if (userId) {
      const { data: candidate } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (candidate?.role !== "client") throw new Error("Portal access is only for client-role accounts.");
    }

    const { error } = await supabase.from("clients").update({ portal_user_id: userId }).eq("id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}
