"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

const FIELDS = [
  "name",
  "description",
  "demographics",
  "stage",
  "pain_points",
  "goals",
  "content_interests",
  "target_belief",
  "target_action",
  "where_they_are",
  "notes",
] as const;
type Field = (typeof FIELDS)[number];

export async function createAudience(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("audiences").insert({ client_id: clientId, name });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/audiences`);
    return undefined;
  });
}

export async function updateAudienceField(
  clientId: string,
  audienceId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "name" && !value.trim()) return { ok: false, message: "Name can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("audiences")
      .update(fieldPatch<Database["public"]["Tables"]["audiences"]["Update"]>(field, value))
      .eq("id", audienceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/audiences`);
    return undefined;
  });
}

/** Duane feedback batch 1: reorder audiences by priority. Normalises every
 * row's sort_order to its current display index (rows created before
 * reordering existed all share 0, tie-broken by created_at), then swaps the
 * moved row with its neighbour. */
export async function moveAudience(clientId: string, audienceId: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("audiences")
      .select("id")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const index = ids.indexOf(audienceId);
    if (index === -1) throw new Error("Audience not found.");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return undefined; // already at the edge

    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    for (let i = 0; i < ids.length; i++) {
      const { error: updateError } = await supabase.from("audiences").update({ sort_order: i }).eq("id", ids[i]!);
      if (updateError) throw new Error(updateError.message);
    }
    revalidatePath(`/clients/${clientId}/audiences`);
    return undefined;
  });
}

export async function deleteAudience(clientId: string, audienceId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("audiences").delete().eq("id", audienceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/audiences`);
    return undefined;
  });
}
