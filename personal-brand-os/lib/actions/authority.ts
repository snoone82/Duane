"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { Database } from "@/lib/database.types";
import type { AuthorityStatus } from "@/lib/enums";
import { AUTHORITY_STATUS } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";

export async function createAuthorityOpportunity(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const type = String(formData.get("type") ?? "").trim();
  const host = String(formData.get("host") ?? "").trim() || null;
  if (!type) return { ok: false, message: "Type is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("authority_opportunities").insert({ client_id: clientId, type, host });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/authority`);
    return undefined;
  });
}

export async function updateAuthorityStatus(
  clientId: string,
  opportunityId: string,
  status: AuthorityStatus
): Promise<ActionResult> {
  if (!AUTHORITY_STATUS.some((s) => s.value === status)) return { ok: false, message: "Invalid status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("authority_opportunities").update({ status }).eq("id", opportunityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/authority`);
    return undefined;
  });
}

const FIELDS = ["type", "host", "contact_name", "contact_email", "opportunity_date", "published_url", "notes", "audience_size"] as const;
type Field = (typeof FIELDS)[number];
// `type` is NOT NULL with no default; `notes` is NOT NULL but defaults to
// ''. Everything else is a genuinely nullable column.
const NULLABLE_FIELDS: Field[] = ["host", "contact_name", "contact_email", "opportunity_date", "published_url", "audience_size"];
const NUMERIC_FIELDS: Field[] = ["audience_size"];

export async function updateAuthorityField(
  clientId: string,
  opportunityId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "type" && !value.trim()) return { ok: false, message: "Type can't be empty." };
  if (NUMERIC_FIELDS.includes(field) && value.trim() && Number.isNaN(Number(value))) {
    return { ok: false, message: "Must be a number." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const patchValue: string | number | null = NUMERIC_FIELDS.includes(field)
      ? (value.trim() ? Number(value) : null)
      : NULLABLE_FIELDS.includes(field)
        ? value || null
        : value;
    const { error } = await supabase
      .from("authority_opportunities")
      .update(fieldPatch<Database["public"]["Tables"]["authority_opportunities"]["Update"]>(field, patchValue))
      .eq("id", opportunityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/authority`);
    return undefined;
  });
}

export async function deleteAuthorityOpportunity(clientId: string, opportunityId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("authority_opportunities").delete().eq("id", opportunityId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/authority`);
    return undefined;
  });
}
