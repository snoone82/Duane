"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

const POSITIONING_FIELDS = [
  "current_positioning",
  "desired_positioning",
  "positioning_statement",
  "expertise",
  "unique_story",
  "differentiators",
  "core_beliefs",
  "contrarian_opinions",
] as const;
type PositioningField = (typeof POSITIONING_FIELDS)[number];

export async function updatePositioningField(
  clientId: string,
  field: PositioningField,
  value: string
): Promise<ActionResult> {
  if (!POSITIONING_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("positioning")
      .update(fieldPatch<Database["public"]["Tables"]["positioning"]["Update"]>(field, value))
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/positioning`);
    return undefined;
  });
}
