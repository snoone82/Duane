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

export async function deletePillar(clientId: string, pillarId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("brand_pillars").delete().eq("id", pillarId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}
