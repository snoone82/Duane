"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { Database } from "@/lib/database.types";
import type { ContentPriority, ContentStatus } from "@/lib/enums";
import { CONTENT_STATUS, CONTENT_PRIORITY } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";

export async function createContentIdea(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const pillarId = String(formData.get("pillar_id") ?? "") || null;
  const audienceId = String(formData.get("audience_id") ?? "") || null;
  const platform = String(formData.get("platform") ?? "").trim() || null;
  const format = String(formData.get("format") ?? "").trim() || null;
  if (!title) return { ok: false, message: "Title is required." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("content_ideas").insert({
      client_id: clientId,
      title,
      pillar_id: pillarId,
      audience_id: audienceId,
      platform,
      format,
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

export async function updateContentIdeaStatus(
  clientId: string,
  ideaId: string,
  status: ContentStatus
): Promise<ActionResult> {
  if (!CONTENT_STATUS.some((s) => s.value === status)) return { ok: false, message: "Invalid status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("content_ideas").update({ status }).eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

export async function updateContentIdeaPriority(
  clientId: string,
  ideaId: string,
  priority: ContentPriority
): Promise<ActionResult> {
  if (!CONTENT_PRIORITY.some((p) => p.value === priority)) return { ok: false, message: "Invalid priority." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("content_ideas").update({ priority }).eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

const FIELDS = [
  "title",
  "body",
  "platform",
  "format",
  "due_date",
  "published_url",
  "notes",
  "pillar_id",
  "audience_id",
  "reach",
  "engagement",
] as const;
type Field = (typeof FIELDS)[number];
// `title` is NOT NULL with no default; `body`/`notes` are NOT NULL but
// default to ''. Everything else is a genuinely nullable column.
const NULLABLE_FIELDS: Field[] = ["platform", "format", "due_date", "published_url", "pillar_id", "audience_id", "reach", "engagement"];
const NUMERIC_FIELDS: Field[] = ["reach", "engagement"];

export async function updateContentIdeaField(
  clientId: string,
  ideaId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "Title can't be empty." };
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
      .from("content_ideas")
      .update(fieldPatch<Database["public"]["Tables"]["content_ideas"]["Update"]>(field, patchValue))
      .eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}

export async function deleteContentIdea(clientId: string, ideaId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("content_ideas").delete().eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/content`);
    return undefined;
  });
}
