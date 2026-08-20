"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

/** Business-level Monthly Sales Target (Duane §3) — one number in the
 * single workspace_settings row. RLS makes writes admin-only; this check
 * just gives a friendlier message than a silent 0-row update. */
export async function setMonthlySalesTarget(value: string): Promise<ActionResult> {
  const trimmed = value.trim();
  const target = trimmed ? Number(trimmed) : null;
  if (trimmed && (Number.isNaN(target) || (target as number) < 0)) {
    return { ok: false, message: "Enter the target as a plain number." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { error, data } = await supabase
      .from("workspace_settings")
      .update({ monthly_sales_target: target })
      .eq("id", true)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Only admins can change the sales target.");
    revalidatePath("/sales");
    revalidatePath("/");
    return undefined;
  });
}

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
