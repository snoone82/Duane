"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

const SALES_FIELDS = [
  "services_products",
  "target_customers",
  "ideal_clients",
  "offers",
  "sales_messaging",
  "lead_generation_approach",
  "calls_to_action",
  "lead_magnets",
  "enquiry_process",
  "sales_conversations",
  "referral_opportunities",
] as const;
type SalesField = (typeof SALES_FIELDS)[number];

export async function updateSalesStrategyField(clientId: string, field: SalesField, value: string): Promise<ActionResult> {
  if (!SALES_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("sales_strategy")
      .update(fieldPatch<Database["public"]["Tables"]["sales_strategy"]["Update"]>(field, value))
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/sales`);
    return undefined;
  });
}
