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

/** Portal-side final-content approval (Duane's workflow §2). RLS + the
 * enforce_content_approval_transition trigger restrict this to the linked
 * client, only on ready_for_approval items, and only these fields — the
 * server action is just the convenient front door. */
export async function portalRespondContent(
  ideaId: string,
  decision: "approve" | "request_changes",
  comments: string
): Promise<ActionResult> {
  if (decision === "request_changes" && !comments.trim()) {
    return { ok: false, message: "Say what needs to change so the team can act on it." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update({
        status: decision === "approve" ? "ready_to_schedule" : "changes_requested",
        approval_comments: comments.trim(),
      })
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("This item is no longer awaiting your approval.");
    // Reopening the linked production Action happens in the
    // reopen_action_on_changes_requested trigger — portal users have no
    // UPDATE rights on actions, so it can't be done here.

    revalidatePath("/portal/content");
    return undefined;
  });
}
