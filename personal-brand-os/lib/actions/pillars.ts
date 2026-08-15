"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

export async function createPillar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("brand_pillars").insert({ client_id: clientId, name, description });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

const FIELDS = [
  "name",
  "description",
  "target_audience",
  "purpose",
  "key_messages",
  "example_topics",
  "associated_stories",
  "relevant_expertise",
  "calls_to_action",
] as const;
type Field = (typeof FIELDS)[number];

export async function updatePillarField(clientId: string, pillarId: string, field: Field, value: string): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "name" && !value.trim()) return { ok: false, message: "Name can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("brand_pillars")
      .update(fieldPatch<Database["public"]["Tables"]["brand_pillars"]["Update"]>(field, value))
      .eq("id", pillarId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

/** Duane feedback batch 1: reorder pillars — same normalise-and-swap as
 * moveAudience (see lib/actions/audiences.ts for the reasoning). */
export async function movePillar(clientId: string, pillarId: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("brand_pillars")
      .select("id")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const index = ids.indexOf(pillarId);
    if (index === -1) throw new Error("Pillar not found.");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return undefined;

    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    for (let i = 0; i < ids.length; i++) {
      const { error: updateError } = await supabase.from("brand_pillars").update({ sort_order: i }).eq("id", ids[i]!);
      if (updateError) throw new Error(updateError.message);
    }
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

export async function deletePillar(clientId: string, pillarId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("brand_pillars").delete().eq("id", pillarId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}
