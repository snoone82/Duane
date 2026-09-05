"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

/**
 * The permanent home for tone/voice, language preferences and CTA direction
 * (Duane, testing Daniel's October plan) — positioning.tone_and_voice was
 * dropped in migration 0004 as out of scope for that rebuild, and nothing
 * replaced it, so a Monthly Plan was reconstructing this from nothing every
 * month instead of inheriting it. createMonthlyPlan reads this row once at
 * creation; editing it here never touches an existing plan.
 */
const CONTENT_GUIDELINES_FIELDS = [
  "secondary_objectives",
  "tone_voice_notes",
  "preferred_language",
  "avoid_language",
  "cta_priorities",
  "primary_cta_destination",
  "content_safeguards",
] as const;
type ContentGuidelinesField = (typeof CONTENT_GUIDELINES_FIELDS)[number];

export async function updateContentGuidelinesField(clientId: string, field: ContentGuidelinesField, value: string): Promise<ActionResult> {
  if (!CONTENT_GUIDELINES_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_guidelines")
      .update(fieldPatch<Database["public"]["Tables"]["content_guidelines"]["Update"]>(field, value))
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/guidelines`);
    return undefined;
  });
}
