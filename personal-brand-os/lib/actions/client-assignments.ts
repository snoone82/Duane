"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";

/** RLS (client_assignments_admin_insert/delete) already restricts these to
 * admins — a non-admin calling either just gets a permission-denied error
 * back through runAction's friendly message, no extra check needed here. */
export async function assignTeamMember(clientId: string, userId: string): Promise<ActionResult> {
  if (!userId) return { ok: false, message: "Choose someone to assign." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_assignments").insert({ client_id: clientId, user_id: userId });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}

export async function unassignTeamMember(clientId: string, userId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_assignments").delete().eq("client_id", clientId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}
