"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/action-result";
import type { ClientStatus } from "@/lib/enums";
import { CLIENT_STATUS } from "@/lib/status";

export async function createClientAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  const company = String(formData.get("company") ?? "").trim() || null;
  const jobTitle = String(formData.get("job_title") ?? "").trim() || null;
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const status = (String(formData.get("status") ?? "prospect") as ClientStatus);
  if (!CLIENT_STATUS.some((s) => s.value === status)) {
    return { ok: false, message: "Invalid status." };
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      company,
      job_title: jobTitle,
      industry,
      status,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Couldn't create the client. Try again." };
  }

  revalidatePath("/clients");
  redirect(`/clients/${data.id}/overview`);
}

export interface ClientHeaderInput {
  name: string;
  company: string | null;
  job_title: string | null;
  industry: string | null;
  location: string | null;
  status: ClientStatus;
  package: string | null;
  retainer_amount: number | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
}

const NUMERIC_CLIENT_FIELDS: (keyof ClientHeaderInput)[] = ["retainer_amount"];

export async function updateClient(clientId: string, patch: Partial<ClientHeaderInput>): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase.from("clients").update(patch).eq("id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}`, "layout");
    revalidatePath("/clients");
    return undefined;
  });
}

export async function updateClientField(
  clientId: string,
  field: keyof ClientHeaderInput,
  value: string
): Promise<ActionResult> {
  if (NUMERIC_CLIENT_FIELDS.includes(field)) {
    if (value.trim() && Number.isNaN(Number(value))) return { ok: false, message: "Must be a number." };
    return updateClient(clientId, { [field]: value.trim() ? Number(value) : null } as Partial<ClientHeaderInput>);
  }
  return updateClient(clientId, { [field]: value || null } as Partial<ClientHeaderInput>);
}
