"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";

export async function createMilestone(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const milestoneDate = String(formData.get("milestone_date") ?? "").trim();
  const isHighlighted = formData.get("is_highlighted") === "on";
  if (!title) return { ok: false, message: "Title is required." };
  if (!milestoneDate) return { ok: false, message: "Date is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("milestones").insert({
      client_id: clientId,
      title,
      description,
      milestone_date: milestoneDate,
      is_highlighted: isHighlighted,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/timeline`);
    return undefined;
  });
}

export async function deleteMilestone(clientId: string, milestoneId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("milestones").delete().eq("id", milestoneId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/timeline`);
    return undefined;
  });
}
