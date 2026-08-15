"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

const FIELDS = [
  "platform",
  "objective",
  "audience",
  "content_types",
  "posting_frequency",
  "growth_strategy",
  "engagement_strategy",
  "cta_strategy",
] as const;
type Field = (typeof FIELDS)[number];

export async function createSocialStrategy(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const platform = String(formData.get("platform") ?? "").trim();
  if (!platform) return { ok: false, message: "Platform is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("social_strategies").insert({ client_id: clientId, platform });
    if (error) {
      if (error.code === "23505") throw new Error(`There's already a strategy for ${platform}.`);
      throw new Error(error.message);
    }
    revalidatePath(`/clients/${clientId}/social`);
    return undefined;
  });
}

export async function updateSocialStrategyField(
  clientId: string,
  strategyId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "platform" && !value.trim()) return { ok: false, message: "Platform can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_strategies")
      .update(fieldPatch<Database["public"]["Tables"]["social_strategies"]["Update"]>(field, value))
      .eq("id", strategyId);
    if (error) {
      if (error.code === "23505") throw new Error(`There's already a strategy for ${value.trim()}.`);
      throw new Error(error.message);
    }
    revalidatePath(`/clients/${clientId}/social`);
    return undefined;
  });
}

export async function deleteSocialStrategy(clientId: string, strategyId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("social_strategies").delete().eq("id", strategyId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/social`);
    return undefined;
  });
}
