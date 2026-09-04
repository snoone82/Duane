"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import { resolveOutstandingProfileLabels } from "@/lib/actions/profile-confirmation";
import type { Database } from "@/lib/database.types";

const VISION_FIELDS = [
  "long_term_goal",
  "desired_positioning",
  "authority_goal",
  "commercial_goal",
  "impact_goal",
  "legacy_contribution",
] as const;
type VisionField = (typeof VISION_FIELDS)[number];

export async function updateVisionField(clientId: string, field: VisionField, value: string): Promise<ActionResult> {
  if (!VISION_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("brand_vision")
      .update(fieldPatch<Database["public"]["Tables"]["brand_vision"]["Update"]>(field, value))
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    // Matches the label the importer uses for this same field (Duane Part
    // H §14) — filling it in here ticks the outstanding-profile item too.
    if (value.trim()) await resolveOutstandingProfileLabels(supabase, clientId, [`Vision → ${field}`]);
    revalidatePath(`/clients/${clientId}/vision`);
    return undefined;
  });
}
