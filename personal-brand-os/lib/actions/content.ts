"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UserFacingError } from "@/lib/errors";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { Database } from "@/lib/database.types";
import type { ContentPriority, ContentStatus } from "@/lib/enums";
import { CONTENT_STATUS, CONTENT_PRIORITY, type OutputStatus } from "@/lib/status";
import { fieldPatch } from "@/lib/field-patch";

/** The production steps seeded into the checklist of the Action that gets
 * created when an idea is approved for production (Duane's workflow §1). */
const PRODUCTION_CHECKLIST = [
  "Write the draft",
  "Record / create the media",
  "Edit the content",
  "Complete internal review",
  "Send for client approval",
  "Schedule the approved content",
];

function revalidateContent(clientId: string) {
  revalidatePath(`/clients/${clientId}/content`);
  revalidatePath(`/clients/${clientId}/actions`);
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function createContentIdea(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const pillarId = String(formData.get("pillar_id") ?? "") || null;
  const audienceId = String(formData.get("audience_id") ?? "") || null;
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
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
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
    revalidateContent(clientId);
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
    revalidateContent(clientId);
    return undefined;
  });
}

const FIELDS = [
  "title",
  "body",
  "hook",
  "due_date",
  "notes",
  "pillar_id",
  "audience_id",
  "approver_user_id",
  "production_due_date",
  "target_publish_date",
] as const;
type Field = (typeof FIELDS)[number];
const NULLABLE_FIELDS: Field[] = [
  "due_date",
  "pillar_id",
  "audience_id",
  "approver_user_id",
  "production_due_date",
  "target_publish_date",
];

export async function updateContentIdeaField(
  clientId: string,
  ideaId: string,
  field: Field,
  value: string
): Promise<ActionResult> {
  if (!FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "title" && !value.trim()) return { ok: false, message: "Title can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const patchValue: string | null = NULLABLE_FIELDS.includes(field) ? value || null : value;
    const { error } = await supabase
      .from("content_ideas")
      .update(fieldPatch<Database["public"]["Tables"]["content_ideas"]["Update"]>(field, patchValue))
      .eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

export async function deleteContentIdea(clientId: string, ideaId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("content_ideas").delete().eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

/** Idea → Approved for production. Creates the linked production Action with
 * a checklist, creates one pending output per chosen platform, and stamps
 * owner / dates / approver — Duane's confirm dialog, made real. */
export async function approveForProduction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const ideaId = String(formData.get("idea_id") ?? "");
  const ownerUserId = String(formData.get("owner_user_id") ?? "") || null;
  const ownerName = String(formData.get("owner_name") ?? "").trim() || null;
  const approverUserId = String(formData.get("approver_user_id") ?? "") || null;
  const productionDue = String(formData.get("production_due_date") ?? "") || null;
  const targetPublish = String(formData.get("target_publish_date") ?? "") || null;
  const requirements = String(formData.get("requirements") ?? "").trim();
  // Publishing accounts from the client's Social tab (ids), plus an optional
  // free-text platform for one-offs not set up as an account.
  const accountIds = formData
    .getAll("accounts")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const extraPlatform = String(formData.get("platform_other") ?? "").trim();
  if (accountIds.length === 0 && !extraPlatform) {
    return { ok: false, message: "Pick at least one publishing account (or type a platform)." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { data: idea, error: ideaError } = await supabase
      .from("content_ideas")
      .select("id,title,status,action_id")
      .eq("id", ideaId)
      .single();
    if (ideaError) throw new Error(ideaError.message);

    // The parent production Action, checklist seeded with Duane's steps.
    const { data: action, error: actionError } = await supabase
      .from("actions")
      .insert({
        client_id: clientId,
        title: `Produce: ${idea.title}`,
        description: requirements,
        due_date: productionDue,
        owner_user_id: ownerUserId,
        owner_name: ownerUserId ? null : ownerName,
        status: "in_progress",
        content_id: ideaId,
        source: "content",
        checklist: PRODUCTION_CHECKLIST.map((text) => ({ text, done: false })),
      })
      .select("id")
      .single();
    if (actionError) throw new Error(actionError.message);

    // One pending output per selected publishing account (dedup against any
    // that already exist for this idea).
    const { data: accounts } = accountIds.length
      ? await supabase.from("social_strategies").select("id,platform").eq("client_id", clientId).in("id", accountIds)
      : { data: [] };
    const { data: existing } = await supabase
      .from("content_outputs")
      .select("platform,social_account_id")
      .eq("content_id", ideaId);
    const haveAccounts = new Set((existing ?? []).map((o) => o.social_account_id).filter(Boolean));
    const havePlatforms = new Set((existing ?? []).map((o) => o.platform.toLowerCase()));

    const rows = [
      ...(accounts ?? [])
        .filter((account) => !haveAccounts.has(account.id))
        .map((account, i) => ({
          content_id: ideaId,
          client_id: clientId,
          platform: account.platform,
          social_account_id: account.id,
          sort_order: i,
        })),
      ...(extraPlatform && !havePlatforms.has(extraPlatform.toLowerCase())
        ? [{ content_id: ideaId, client_id: clientId, platform: extraPlatform, social_account_id: null, sort_order: accountIds.length }]
        : []),
    ];
    if (rows.length > 0) {
      const { error: outputError } = await supabase.from("content_outputs").insert(rows);
      if (outputError) throw new Error(outputError.message);
    }

    const { error: updateError } = await supabase
      .from("content_ideas")
      .update({
        status: "approved_production",
        action_id: action.id,
        approver_user_id: approverUserId,
        production_due_date: productionDue,
        target_publish_date: targetPublish,
      })
      .eq("id", ideaId);
    if (updateError) throw new Error(updateError.message);

    revalidateContent(clientId);
    return undefined;
  });
}

/** Ready for approval → Changes requested (team side). Reopens the linked
 * production Action so the work lands back with its owner. */
export async function requestContentChanges(clientId: string, ideaId: string, comments: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: idea, error: readError } = await supabase
      .from("content_ideas")
      .select("action_id,approval_comments")
      .eq("id", ideaId)
      .single();
    if (readError) throw new Error(readError.message);

    const { error } = await supabase
      .from("content_ideas")
      .update({
        status: "changes_requested",
        approval_comments: comments.trim() || idea.approval_comments,
      })
      .eq("id", ideaId);
    if (error) throw new Error(error.message);

    if (idea.action_id) {
      await supabase.from("actions").update({ status: "in_progress", completed_at: null }).eq("id", idea.action_id);
    }
    revalidateContent(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Platform outputs
// ---------------------------------------------------------------------------

export async function addContentOutput(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const contentId = String(formData.get("content_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "").trim();
  const platformRaw = String(formData.get("platform") ?? "").trim();
  const format = String(formData.get("format") ?? "").trim();
  if (!accountId && !platformRaw) return { ok: false, message: "Pick a publishing account or type a platform." };

  return runAction(async () => {
    const supabase = await createClient();
    let platform = platformRaw;
    if (accountId) {
      const { data: account } = await supabase
        .from("social_strategies")
        .select("platform")
        .eq("id", accountId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!account) throw new Error("That publishing account doesn't belong to this client.");
      platform = account.platform;
    }
    const { error } = await supabase
      .from("content_outputs")
      .insert({ content_id: contentId, client_id: clientId, platform, format, social_account_id: accountId || null });
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

/** Point a platform version at a different publishing account (or clear it).
 * Choosing an account also syncs the platform label from the account. */
export async function assignOutputAccount(clientId: string, outputId: string, accountId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    let patch: { social_account_id: string | null; platform?: string } = { social_account_id: accountId };
    if (accountId) {
      const { data: account } = await supabase
        .from("social_strategies")
        .select("platform")
        .eq("id", accountId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!account) throw new Error("That publishing account doesn't belong to this client.");
      patch = { social_account_id: accountId, platform: account.platform };
    }
    const { error } = await supabase.from("content_outputs").update(patch).eq("id", outputId);
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

const OUTPUT_FIELDS = [
  "platform",
  "format",
  "caption",
  "cta",
  "hashtags",
  "alt_text",
  "destination_link",
  // Externally hosted media — kept separate from destination_link, which is
  // the CTA/web destination and must never double as the video asset.
  "media_source_url",
  "thumbnail_source_url",
  "live_url",
  "notes",
  "reach",
  "engagement",
  "views",
] as const;
type OutputField = (typeof OUTPUT_FIELDS)[number];
const OUTPUT_NUMERIC: OutputField[] = ["reach", "engagement", "views"];

export async function updateContentOutputField(
  clientId: string,
  outputId: string,
  field: OutputField,
  value: string
): Promise<ActionResult> {
  if (!OUTPUT_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "platform" && !value.trim()) return { ok: false, message: "Platform can't be empty." };
  if (OUTPUT_NUMERIC.includes(field) && value.trim() && Number.isNaN(Number(value))) {
    return { ok: false, message: "Must be a number." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const patchValue: string | number | null = OUTPUT_NUMERIC.includes(field)
      ? (value.trim() ? Number(value) : null)
      : value;
    const { error } = await supabase
      .from("content_outputs")
      .update(fieldPatch<Database["public"]["Tables"]["content_outputs"]["Update"]>(field, patchValue))
      .eq("id", outputId);
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

export async function deleteContentOutput(clientId: string, outputId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("content_outputs").delete().eq("id", outputId);
    if (error) throw new Error(error.message);
    revalidateContent(clientId);
    return undefined;
  });
}

/** Recompute the master record's status from its outputs: every output
 * scheduled → master Scheduled; every output published → master Published.
 * (Scheduling LinkedIn never marks Instagram as anything — Duane §5.) */
export async function rollUpMasterStatus(supabase: Awaited<ReturnType<typeof createClient>>, contentId: string) {
  const [{ data: outputs }, { data: idea }] = await Promise.all([
    supabase.from("content_outputs").select("status").eq("content_id", contentId),
    supabase.from("content_ideas").select("status,action_id").eq("id", contentId).single(),
  ]);
  if (!outputs || outputs.length === 0 || !idea) return;

  const all = (s: OutputStatus) => outputs.every((o) => o.status === s || (s === "scheduled" && o.status === "published"));
  if (outputs.every((o) => o.status === "published")) {
    if (idea.status !== "published") {
      await supabase.from("content_ideas").update({ status: "published" }).eq("id", contentId);
      // Production is done — close the linked Action if it's still open.
      if (idea.action_id) {
        await supabase
          .from("actions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", idea.action_id)
          .neq("status", "completed");
      }
    }
  } else if (all("scheduled")) {
    if (idea.status === "ready_to_schedule" || idea.status === "in_production" || idea.status === "ready_for_approval") {
      await supabase.from("content_ideas").update({ status: "scheduled" }).eq("id", contentId);
    }
  }
}

export async function scheduleContentOutput(
  clientId: string,
  outputId: string,
  scheduledAt: string
): Promise<ActionResult> {
  if (!scheduledAt) return { ok: false, message: "Pick a date and time." };
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return { ok: false, message: "That date didn't parse." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: output, error } = await supabase
      .from("content_outputs")
      .update({ scheduled_at: when.toISOString(), status: "scheduled" })
      .eq("id", outputId)
      .select("content_id")
      .single();
    if (error) throw new Error(error.message);
    await rollUpMasterStatus(supabase, output.content_id);
    revalidateContent(clientId);
    return undefined;
  });
}

export async function publishContentOutput(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const outputId = String(formData.get("output_id") ?? "");
  const liveUrl = String(formData.get("live_url") ?? "").trim();
  const publishedAtRaw = String(formData.get("published_at") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
  if (Number.isNaN(publishedAt.getTime())) return { ok: false, message: "That date didn't parse." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("content_outputs")
      .select("notes")
      .eq("id", outputId)
      .single();
    if (readError) throw new Error(readError.message);

    const { data: output, error } = await supabase
      .from("content_outputs")
      .update({
        status: "published",
        published_at: publishedAt.toISOString(),
        live_url: liveUrl,
        notes: notes ? (current.notes ? `${current.notes}\n${notes}` : notes) : current.notes,
      })
      .eq("id", outputId)
      .select("content_id")
      .single();
    if (error) throw new Error(error.message);
    await rollUpMasterStatus(supabase, output.content_id);
    revalidateContent(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Media assets per platform version (Duane's §2: the record holds the actual
// media, uploaded for sign-off, pulled from here when posting). Stored in the
// private client-files bucket; a ten-year signed URL is written alongside the
// path so the portal can preview it during approval (same pattern as the
// client profile photo).
// ---------------------------------------------------------------------------

const MEDIA_KINDS = ["media", "thumbnail"] as const;
type MediaKind = (typeof MEDIA_KINDS)[number];
const MEDIA_BUCKET = "client-files";
const MEDIA_MAX_BYTES = 200 * 1024 * 1024;

/** Attach media that the browser has ALREADY uploaded straight to storage.
 * Server actions can't carry real media files (Next caps action bodies at
 * 1 MB and Vercel at ~4.5 MB — the bug Duane hit), so the browser uploads
 * directly to the bucket under the client's RLS-guarded path and this
 * action just verifies, signs and records it. */
export async function attachOutputMedia(
  clientId: string,
  outputId: string,
  kind: MediaKind,
  storagePath: string
): Promise<ActionResult> {
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, message: "Unknown media slot." };
  // The path must be inside this client's content area — anything else is
  // either a mistake or someone playing games.
  if (!storagePath.startsWith(`clients/${clientId}/content/${outputId}/`) || storagePath.includes("..")) {
    return { ok: false, message: "Unexpected storage path." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("content_outputs")
      .select("media_path,thumbnail_path,client_id")
      .eq("id", outputId)
      .single();
    if (readError) throw new Error(readError.message);
    if (existing.client_id !== clientId) throw new Error("That platform version belongs to a different client.");

    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message ?? "Couldn't create the media link — was the upload interrupted?");

    const patch =
      kind === "media"
        ? { media_path: storagePath, media_url: signed.signedUrl }
        : { thumbnail_path: storagePath, thumbnail_url: signed.signedUrl };
    const { error: updateError } = await supabase.from("content_outputs").update(patch).eq("id", outputId);
    if (updateError) throw new Error(updateError.message);

    const oldPath = kind === "media" ? existing.media_path : existing.thumbnail_path;
    if (oldPath && oldPath !== storagePath) {
      await supabase.storage.from(MEDIA_BUCKET).remove([oldPath]);
    }

    revalidateContent(clientId);
    return undefined;
  });
}

export async function uploadOutputMedia(clientId: string, outputId: string, kind: MediaKind, formData: FormData): Promise<ActionResult> {
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, message: "Unknown media slot." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };
  if (file.size > MEDIA_MAX_BYTES) return { ok: false, message: "Keep media under 200 MB." };
  if (kind === "thumbnail" && !file.type.startsWith("image/")) {
    return { ok: false, message: "Thumbnails must be images." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("content_outputs")
      .select("media_path,thumbnail_path")
      .eq("id", outputId)
      .single();
    if (readError) throw new Error(readError.message);

    const storagePath = `clients/${clientId}/content/${outputId}/${kind}-${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, file, {
      contentType: file.type || undefined,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message ?? "Couldn't create the media link.");

    const patch =
      kind === "media"
        ? { media_path: storagePath, media_url: signed.signedUrl }
        : { thumbnail_path: storagePath, thumbnail_url: signed.signedUrl };
    const { error: updateError } = await supabase.from("content_outputs").update(patch).eq("id", outputId);
    if (updateError) {
      await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      throw new Error(updateError.message);
    }

    // Replacing? Tidy up the old object best-effort.
    const oldPath = kind === "media" ? existing.media_path : existing.thumbnail_path;
    if (oldPath && oldPath !== storagePath) {
      await supabase.storage.from(MEDIA_BUCKET).remove([oldPath]);
    }

    revalidateContent(clientId);
    return undefined;
  });
}

export async function removeOutputMedia(clientId: string, outputId: string, kind: MediaKind): Promise<ActionResult> {
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, message: "Unknown media slot." };
  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("content_outputs")
      .select("media_path,thumbnail_path")
      .eq("id", outputId)
      .single();
    if (readError) throw new Error(readError.message);

    const oldPath = kind === "media" ? existing.media_path : existing.thumbnail_path;
    const patch =
      kind === "media"
        ? { media_path: null, media_url: null }
        : { thumbnail_path: null, thumbnail_url: null };
    const { error } = await supabase.from("content_outputs").update(patch).eq("id", outputId);
    if (error) throw new Error(error.message);

    // Detach, don't destroy. Removing media from one platform version used to
    // delete the underlying file, which cost Duane a 145 MB upload and made a
    // working URL look like it had expired. With master media shared across
    // versions it would be actively destructive, so the object only goes once
    // nothing — idea or version — still points at it.
    if (oldPath) await removeObjectIfUnreferenced(supabase, oldPath);

    revalidateContent(clientId);
    return undefined;
  });
}

/** Undo a schedule (back to the Ready-to-Schedule queue). */
export async function unscheduleContentOutput(clientId: string, outputId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: output, error } = await supabase
      .from("content_outputs")
      .update({ scheduled_at: null, status: "pending" })
      .eq("id", outputId)
      .select("content_id")
      .single();
    if (error) throw new Error(error.message);
    // Master may have been auto-advanced to scheduled; pull it back.
    const { data: idea } = await supabase.from("content_ideas").select("status").eq("id", output.content_id).single();
    if (idea?.status === "scheduled") {
      await supabase.from("content_ideas").update({ status: "ready_to_schedule" }).eq("id", output.content_id);
    }
    revalidateContent(clientId);
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Master media on the content idea (Duane, 3 Sep 2026)
// ---------------------------------------------------------------------------

/**
 * Attach the master asset to a content idea. Every platform version with no
 * media of its own then inherits it automatically — Duane chose inheritance
 * over a copy button, so there is nothing to click per platform and nothing
 * is duplicated in storage.
 */
export async function attachIdeaMedia(
  clientId: string,
  ideaId: string,
  kind: MediaKind,
  storagePath: string
): Promise<ActionResult> {
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, message: "Unknown media slot." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("content_ideas")
      .select("media_path,thumbnail_path,client_id")
      .eq("id", ideaId)
      .single();
    if (readError) throw new Error(readError.message);
    if (existing.client_id !== clientId) throw new Error("That content idea belongs to a different client.");

    // The signed URL here is only for previewing in the admin UI. Publishing
    // always mints a fresh one from the path.
    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) {
      throw new Error(signError?.message ?? "Couldn't create the media link — was the upload interrupted?");
    }

    const patch =
      kind === "media"
        ? { media_path: storagePath, media_url: signed.signedUrl }
        : { thumbnail_path: storagePath, thumbnail_url: signed.signedUrl };
    const { error } = await supabase.from("content_ideas").update(patch).eq("id", ideaId);
    if (error) throw new Error(error.message);

    const oldPath = kind === "media" ? existing.media_path : existing.thumbnail_path;
    if (oldPath && oldPath !== storagePath) await removeObjectIfUnreferenced(supabase, oldPath);

    revalidateContent(clientId);
    return undefined;
  });
}

export async function removeIdeaMedia(clientId: string, ideaId: string, kind: MediaKind): Promise<ActionResult> {
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, message: "Unknown media slot." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("content_ideas")
      .select("media_path,thumbnail_path,client_id")
      .eq("id", ideaId)
      .single();
    if (readError) throw new Error(readError.message);
    if (existing.client_id !== clientId) throw new Error("That content idea belongs to a different client.");

    const oldPath = kind === "media" ? existing.media_path : existing.thumbnail_path;
    const patch =
      kind === "media"
        ? { media_path: null, media_url: null }
        : { thumbnail_path: null, thumbnail_url: null };
    const { error } = await supabase.from("content_ideas").update(patch).eq("id", ideaId);
    if (error) throw new Error(error.message);

    if (oldPath) await removeObjectIfUnreferenced(supabase, oldPath);

    revalidateContent(clientId);
    return undefined;
  });
}

/**
 * Delete the stored object only once nothing points at it any more.
 *
 * Removing media used to delete the file outright, which cost Duane a 145 MB
 * upload. With master media shared across platform versions it would be
 * actively destructive — so every reference, idea and version alike, has to
 * be gone first.
 */
async function removeObjectIfUnreferenced(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<void> {
  const counts = await Promise.all([
    supabase.from("content_outputs").select("id", { count: "exact", head: true }).eq("media_path", path),
    supabase.from("content_outputs").select("id", { count: "exact", head: true }).eq("thumbnail_path", path),
    supabase.from("content_ideas").select("id", { count: "exact", head: true }).eq("media_path", path),
    supabase.from("content_ideas").select("id", { count: "exact", head: true }).eq("thumbnail_path", path),
  ]);
  const stillUsed = counts.some(({ count }) => (count ?? 0) > 0);
  if (!stillUsed) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

// ---------------------------------------------------------------------------
// Master post schedule (Duane, 3 Sep 2026)
// ---------------------------------------------------------------------------

/**
 * Set the publish date and time once at the master level and every platform
 * version takes it — the same enter-once-populate-everywhere principle as
 * master media. Each version keeps its own scheduled_at afterwards, so
 * Instagram can still be moved without touching LinkedIn.
 *
 * Rules: published versions are never touched; a version already handed to
 * Ayrshare's scheduler is left alone too (moving its time here would not
 * move it there — reschedule that one from its own row). Clearing the master
 * clears the time on versions that are not yet on the calendar; a version
 * already scheduled stays scheduled, since taking it off is Unschedule's job.
 */
export async function setMasterSchedule(
  clientId: string,
  ideaId: string,
  scheduledAt: string
): Promise<ActionResult<{ applied: number; skipped: number }>> {
  const value = scheduledAt.trim();
  const when = value ? new Date(value) : null;
  if (when && Number.isNaN(when.getTime())) return { ok: false, message: "That date didn't parse." };
  const iso = when ? when.toISOString() : null;

  return runAction(async () => {
    const supabase = await createClient();
    const { error: ideaError } = await supabase
      .from("content_ideas")
      .update({ scheduled_at: iso })
      .eq("id", ideaId)
      .eq("client_id", clientId);
    if (ideaError) throw new Error(ideaError.message);

    const { data: outputs, error: readError } = await supabase
      .from("content_outputs")
      .select("id,status,ayrshare_post_id")
      .eq("content_id", ideaId)
      .eq("client_id", clientId);
    if (readError) throw new Error(readError.message);

    const eligible = (outputs ?? []).filter((o) => {
      if (o.status === "published") return false;
      if (o.ayrshare_post_id) return false;
      if (!iso && o.status === "scheduled") return false;
      return true;
    });
    if (eligible.length > 0) {
      const { error } = await supabase
        .from("content_outputs")
        .update({ scheduled_at: iso })
        .in(
          "id",
          eligible.map((o) => o.id)
        );
      if (error) throw new Error(error.message);
    }

    revalidateContent(clientId);
    const unpublished = (outputs ?? []).filter((o) => o.status !== "published").length;
    return { applied: eligible.length, skipped: unpublished - eligible.length };
  });
}

/**
 * The one-click confirmation after a master schedule: every unpublished
 * version that has a time but is not yet on the calendar becomes Scheduled
 * at its own time (master or individually amended).
 */
export async function scheduleAllOutputs(
  clientId: string,
  ideaId: string
): Promise<ActionResult<{ scheduled: number }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: outputs, error: readError } = await supabase
      .from("content_outputs")
      .select("id,status,scheduled_at")
      .eq("content_id", ideaId)
      .eq("client_id", clientId);
    if (readError) throw new Error(readError.message);

    const pending = (outputs ?? []).filter(
      (o) => o.scheduled_at && o.status !== "scheduled" && o.status !== "published"
    );
    if (pending.length === 0) throw new UserFacingError("Every platform version with a time is already on the calendar.");

    const { error } = await supabase
      .from("content_outputs")
      .update({ status: "scheduled" })
      .in(
        "id",
        pending.map((o) => o.id)
      );
    if (error) throw new Error(error.message);

    await rollUpMasterStatus(supabase, ideaId);
    revalidateContent(clientId);
    return { scheduled: pending.length };
  });
}
