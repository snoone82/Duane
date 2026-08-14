"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { fieldPatch } from "@/lib/field-patch";
import type { Database } from "@/lib/database.types";

function revalidateConsultationPaths(clientId: string) {
  revalidatePath(`/clients/${clientId}/consultations`);
  revalidatePath(`/clients/${clientId}/overview`);
  revalidatePath("/");
}

export async function createConsultation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const meetingDate = String(formData.get("meeting_date") ?? "").trim();
  const meetingType = String(formData.get("meeting_type") ?? "").trim() || null;
  const nextMeetingDate = String(formData.get("next_meeting_date") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim();
  const attendees = String(formData.get("attendees") ?? "").trim();
  if (!meetingDate) return { ok: false, message: "Meeting date is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("consultations").insert({
      client_id: clientId,
      meeting_date: meetingDate,
      meeting_type: meetingType,
      next_meeting_date: nextMeetingDate,
      summary,
      attendees,
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidateConsultationPaths(clientId);
    return undefined;
  });
}

const FIELDS = [
  "meeting_date",
  "meeting_type",
  "next_meeting_date",
  "attendees",
  "summary",
  "client_updates",
  "wins",
  "challenges",
  "strategic_observations",
  "decisions_made",
  "content_discussed",
  "commercial_opportunities",
] as const;
type Field = (typeof FIELDS)[number];
// `meeting_date` is NOT NULL (defaults to current_date, but once set can
// never go back to null); the text fields are NOT NULL defaulting to ''.
// `meeting_type`/`next_meeting_date` are the only genuinely nullable ones.
const NULLABLE_FIELDS: Field[] = ["meeting_type", "next_meeting_date"];

export async function updateConsultationField(clientId: string, consultationId: string, field: Field, value: string): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "meeting_date" && !value.trim()) return { ok: false, message: "Meeting date can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const patchValue = NULLABLE_FIELDS.includes(field) ? value || null : value;
    const { error } = await supabase
      .from("consultations")
      .update(fieldPatch<Database["public"]["Tables"]["consultations"]["Update"]>(field, patchValue))
      .eq("id", consultationId);
    if (error) throw new Error(error.message);
    revalidateConsultationPaths(clientId);
    return undefined;
  });
}

export async function deleteConsultation(clientId: string, consultationId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("consultations").delete().eq("id", consultationId);
    if (error) throw new Error(error.message);
    revalidateConsultationPaths(clientId);
    return undefined;
  });
}
