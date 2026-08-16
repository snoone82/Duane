"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { Database } from "@/lib/database.types";
import type { ActionStatus } from "@/lib/enums";
import { ACTION_STATUS } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";

function revalidateActionPaths(clientId: string) {
  revalidatePath(`/clients/${clientId}/actions`);
  revalidatePath(`/clients/${clientId}/overview`);
  revalidatePath(`/clients/${clientId}/consultations`);
  revalidatePath("/actions");
  revalidatePath("/");
}

/**
 * The fast path used both by the Actions tab's own "+ Add action" and by the
 * quick-add mini-form inside an expanded consultation card — the brief's
 * "add four actions from a consultation without leaving the page" case.
 * Owner defaults to whoever's signed in when no owner is picked, since
 * `actions_owner_present` requires one or the other and reassigning later
 * from the Actions tab is one field, not a blocker to capturing it now.
 */
export async function createAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const ownerName = String(formData.get("owner_name") ?? "").trim() || null;
  const consultationId = String(formData.get("consultation_id") ?? "").trim() || null;
  if (!title) return { ok: false, message: "Title is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("actions").insert({
      client_id: clientId,
      title,
      due_date: dueDate,
      owner_name: ownerName,
      owner_user_id: ownerName ? null : (user?.id ?? null),
      consultation_id: consultationId,
    });
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    return undefined;
  });
}

export async function updateActionStatus(clientId: string, actionId: string, status: ActionStatus): Promise<ActionResult> {
  if (!ACTION_STATUS.some((s) => s.value === status)) return { ok: false, message: "Invalid status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("actions")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    return undefined;
  });
}

const FIELDS = ["title", "description", "due_date", "owner_name"] as const;
type Field = (typeof FIELDS)[number];
// `title` is NOT NULL with no default — clearing it to null would violate the
// column. `description` is NOT NULL but defaults to '' — an empty string is
// a valid value, never null. Only due_date/owner_name are genuinely nullable.
const NULLABLE_FIELDS: Field[] = ["due_date", "owner_name"];

export async function updateActionField(clientId: string, actionId: string, field: Field, value: string): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "Title can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const patchValue = NULLABLE_FIELDS.includes(field) ? value || null : value;
    const { error } = await supabase
      .from("actions")
      .update(fieldPatch<Database["public"]["Tables"]["actions"]["Update"]>(field, patchValue))
      .eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    return undefined;
  });
}

/** Tick/untick one production-checklist step. Read-modify-write on the jsonb
 * array; last write wins, which is fine for a checklist two people rarely
 * touch in the same second. */
export async function toggleChecklistItem(
  clientId: string,
  actionId: string,
  index: number,
  done: boolean
): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: action, error: readError } = await supabase
      .from("actions")
      .select("checklist")
      .eq("id", actionId)
      .single();
    if (readError) throw new Error(readError.message);

    const list = Array.isArray(action.checklist)
      ? (action.checklist as { text: string; done: boolean }[])
      : [];
    if (index < 0 || index >= list.length) return undefined;
    const next = list.map((item, i) => (i === index ? { ...item, done } : item));

    const { error } = await supabase.from("actions").update({ checklist: next }).eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

export async function deleteAction(clientId: string, actionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("actions").delete().eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    return undefined;
  });
}
