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

export async function deleteAudience(clientId: string, audienceId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("audiences").delete().eq("id", audienceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/audiences`);
    return undefined;
  });
}
