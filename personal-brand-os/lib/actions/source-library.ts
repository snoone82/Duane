"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { SOURCE_ITEM_KINDS } from "@/lib/monthly-plan-format";

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/consultations`);
  revalidatePath(`/clients/${clientId}/plans`, "layout");
}

/** Add one item to the Client Source Library by hand. Imports add them in
 * bulk (client-profile import → source_library). */
export async function addSourceItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const kind = String(formData.get("kind") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!SOURCE_ITEM_KINDS.some((k) => k.value === kind)) return { ok: false, message: "Pick what kind of item this is." };
  if (!text) return { ok: false, message: "The item itself is required." };
  const sensitivity = String(formData.get("sensitivity") ?? "public") === "sensitive" ? "sensitive" : "public";
  const sourceDate = String(formData.get("source_date") ?? "").trim() || null;
  const consultationId = String(formData.get("consultation_id") ?? "").trim() || null;
  const pillarId = String(formData.get("pillar_id") ?? "").trim() || null;

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_source_items").insert({
      client_id: clientId,
      consultation_id: consultationId,
      kind,
      text,
      source_quote: String(formData.get("source_quote") ?? "").trim(),
      source_date: sourceDate,
      pillar_id: pillarId,
      sensitivity,
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidate(clientId);
    return undefined;
  });
}

export async function deleteSourceItem(clientId: string, itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_source_items").delete().eq("id", itemId).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidate(clientId);
    return undefined;
  });
}

export async function setSourceItemSensitivity(clientId: string, itemId: string, sensitivity: "public" | "sensitive"): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_source_items").update({ sensitivity }).eq("id", itemId).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidate(clientId);
    return undefined;
  });
}
