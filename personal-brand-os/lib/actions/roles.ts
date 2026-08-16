"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { ProfileRole } from "@/lib/enums";

const ROLES: ProfileRole[] = ["admin", "member", "contractor", "client"];

/** Admin-only role changes from inside the app — no more SQL editor for
 * promotions, and portal accounts can be given the client role here. The
 * prevent_role_self_escalation trigger independently enforces that only an
 * admin session can change a role; this action adds the guardrails the
 * trigger can't express. */
export async function setUserRole(targetUserId: string, role: ProfileRole): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { ok: false, message: "Unknown role." };

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can change roles." };
  if (profile.id === targetUserId) {
    return { ok: false, message: "You can't change your own role — ask another admin, so the workspace always keeps one." };
  }

  return runAction(async () => {
    const supabase = await createClient();

    // Demoting the last remaining admin would lock everyone out of admin
    // features with no way back except the SQL editor.
    const { data: target } = await supabase.from("profiles").select("role").eq("id", targetUserId).maybeSingle();
    if (!target) throw new Error("That account no longer exists.");
    if (target.role === "admin" && role !== "admin") {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("That's the only admin left — promote someone else first.");
    }

    // Moving someone OUT of the client role while they're linked to a client
    // would give a portal login team access; unlink first.
    if (target.role === "client" && role !== "client") {
      await supabase.from("clients").update({ portal_user_id: null }).eq("portal_user_id", targetUserId);
    }

    const { error } = await supabase.from("profiles").update({ role }).eq("id", targetUserId);
    if (error) throw new Error(error.message);

    revalidatePath("/team");
    return undefined;
  });
}
