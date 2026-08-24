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

/** The grouped owner dropdown encodes its selection as `u:<userId>` (a
 * team member or a linked client-team login) or `n:<name>` (an unlinked
 * client-team member, or free text). Empty = unassigned → defaults to the
 * signed-in user, since `actions_owner_present` requires one or the other. */
function decodeOwner(raw: string, fallbackUserId: string | null): { owner_user_id: string | null; owner_name: string | null } {
  const value = raw.trim();
  if (value.startsWith("u:")) return { owner_user_id: value.slice(2), owner_name: null };
  if (value.startsWith("n:")) return { owner_user_id: null, owner_name: value.slice(2).trim() || null };
  if (value) return { owner_user_id: null, owner_name: value };
  return { owner_user_id: fallbackUserId, owner_name: null };
}

type ChecklistItem = { text: string; done: boolean };

function parseChecklist(raw: string): ChecklistItem[] {
  if (!raw.trim()) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => ({ text: String(item?.text ?? "").trim(), done: item?.done === true }))
      .filter((item) => item.text);
  } catch {
    return [];
  }
}

const PRIORITIES = ["low", "medium", "high"];
const VISIBILITIES = ["internal", "client"];

/**
 * The fast path used both by the Actions tab's own "+ Add action" and by the
 * quick-add mini-form inside an expanded consultation card — the brief's
 * "add four actions from a consultation without leaving the page" case.
 * Now carries the full Add Action form (Duane batch 6): status, priority,
 * description, visibility and a checklist, all optional so the quick-add
 * keeps working with just a title.
 */
export async function createAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const consultationId = String(formData.get("consultation_id") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const visibilityRaw = String(formData.get("visibility") ?? "").trim();
  const checklist = parseChecklist(String(formData.get("checklist") ?? ""));
  if (!title) return { ok: false, message: "Title is required." };

  const status = ACTION_STATUS.some((s) => s.value === statusRaw) ? (statusRaw as ActionStatus) : "not_started";
  const priority = PRIORITIES.includes(priorityRaw) ? priorityRaw : "medium";
  const visibility = VISIBILITIES.includes(visibilityRaw) ? visibilityRaw : "internal";

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Older callers (quick-add) still send owner_name; the new form sends
    // the encoded `owner` select value. Either way works.
    const legacyOwner = String(formData.get("owner_name") ?? "").trim();
    const owner = decodeOwner(String(formData.get("owner") ?? "") || (legacyOwner ? `n:${legacyOwner}` : ""), user?.id ?? null);

    const { error } = await supabase.from("actions").insert({
      client_id: clientId,
      title,
      due_date: dueDate,
      ...owner,
      consultation_id: consultationId,
      description,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      priority,
      visibility,
      source: consultationId ? "meeting" : "manual",
      checklist,
    });
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    return undefined;
  });
}

/** The Edit Action panel's save — every editable field in one round trip.
 * Source and linked records stay read-only: where a task came from is
 * history, not an opinion. */
export async function updateActionDetails(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const actionId = String(formData.get("action_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const visibilityRaw = String(formData.get("visibility") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };
  if (!ACTION_STATUS.some((s) => s.value === statusRaw)) return { ok: false, message: "Invalid status." };
  if (!PRIORITIES.includes(priorityRaw) || !VISIBILITIES.includes(visibilityRaw)) {
    return { ok: false, message: "Invalid priority or visibility." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const owner = decodeOwner(String(formData.get("owner") ?? ""), user?.id ?? null);

    const { error } = await supabase
      .from("actions")
      .update({
        title,
        description: String(formData.get("description") ?? "").trim(),
        due_date: String(formData.get("due_date") ?? "").trim() || null,
        ...owner,
        status: statusRaw as ActionStatus,
        completed_at: statusRaw === "completed" ? new Date().toISOString() : null,
        priority: priorityRaw,
        visibility: visibilityRaw,
        checklist: parseChecklist(String(formData.get("checklist") ?? "")),
      })
      .eq("id", actionId);
    if (error) throw new Error(error.message);
    revalidateActionPaths(clientId);
    revalidatePath(`/clients/${clientId}/content`);
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
