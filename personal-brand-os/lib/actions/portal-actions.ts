"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { ACTION_STATUS } from "@/lib/status";
import type { ActionStatus } from "@/lib/enums";

/** Portal-side Action updates (Duane Part I). RLS decides WHICH actions a
 * portal account may touch (their own, or client-visible ones when their
 * membership allows), and the restrict_portal_action_updates trigger
 * decides WHAT they may change (status, checklist, notes) — these server
 * actions are just the front door. Both sides update the same Action
 * record the team sees. */

function revalidatePortal() {
  revalidatePath("/portal/priorities");
  revalidatePath("/portal");
}

export async function portalUpdateActionStatus(actionId: string, status: ActionStatus): Promise<ActionResult> {
  if (!ACTION_STATUS.some((s) => s.value === status)) return { ok: false, message: "Invalid status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("actions")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", actionId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("You don't have permission to update this action.");
    revalidatePortal();
    return undefined;
  });
}

export async function portalToggleChecklistItem(actionId: string, index: number, done: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: action, error: readError } = await supabase
      .from("actions")
      .select("checklist")
      .eq("id", actionId)
      .single();
    if (readError) throw new Error(readError.message);

    const list = Array.isArray(action.checklist) ? (action.checklist as { text: string; done: boolean }[]) : [];
    if (index < 0 || index >= list.length) return undefined;
    const next = list.map((item, i) => (i === index ? { ...item, done } : item));

    const { data: updated, error } = await supabase
      .from("actions")
      .update({ checklist: next })
      .eq("id", actionId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("You don't have permission to update this action.");
    revalidatePortal();
    return undefined;
  });
}

export async function portalSaveActionNote(actionId: string, note: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("actions")
      .update({ portal_notes: note.trim() })
      .eq("id", actionId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("You don't have permission to update this action.");
    revalidatePortal();
    return undefined;
  });
}
