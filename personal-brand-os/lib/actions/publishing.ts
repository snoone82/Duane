"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { inspectMediaUrl, isVideoMedia, resolveMedia } from "@/lib/media-source";
import { rollUpMasterStatus } from "@/lib/actions/content";
import type { Database, Json } from "@/lib/database.types";
import {
  AyrshareError,
  AYRSHARE_PLATFORMS,
  MEDIA_REQUIRED_PLATFORMS,
  YOUTUBE_TITLE_MAX,
  type AyrshareYouTubeOptions,
  createAyrshareProfile,
  getAyrshareLinkUrl,
  getLinkedNetworks,
  sendAyrsharePost,
  getAyrsharePostUrl,
  getAyrshareHistory,
  getAyrsharePostAnalytics,
  type AyrshareHistoryRecord,
} from "@/lib/ayrshare";
import { cancelOpenHandover, resolveProfileKey } from "@/lib/ayrshare-handover";
import {
  appendHandover,
  closeHandover,
  openHandover,
  readHistory,
  type HandoverEntry,
} from "@/lib/ayrshare-history";

function revalidateSocial(clientId: string) {
  revalidatePath(`/clients/${clientId}/social`);
}

function revalidateContent(clientId: string) {
  revalidatePath(`/clients/${clientId}/content`);
  revalidatePath("/calendar");
}

/** Create an Ayrshare connection profile for one identity (e.g. "Daniel
 * Andrews", "CEG"). Admin-only — this is publishing infrastructure. */
export async function createConnectionProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Give the connection a name — usually the person or brand it represents." };

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can manage publishing connections." };

  return runAction(async () => {
    const created = await createAyrshareProfile(title);
    const supabase = await createClient();
    const { error } = await supabase.from("ayrshare_profiles").insert({
      client_id: clientId,
      title,
      profile_key: created.profileKey,
      ref_id: created.refId,
    });
    if (error) throw new UserFacingError(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

/** The branded page where the account owner links their socials. Generated
 * on demand (the token only lives ~5 minutes) and opened client-side. */
export async function getConnectionLinkUrl(clientId: string, profileId: string): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can manage publishing connections." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("ayrshare_profiles")
      .select("profile_key,client_id")
      .eq("id", profileId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);
    return getAyrshareLinkUrl(row.profile_key);
  });
}

/** Which networks are actually connected on a profile right now — shown on
 * the Social tab so "linked" vs "not linked yet" is never a guess. */
export async function getConnectionStatus(clientId: string, profileId: string): Promise<ActionResult<string[]>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("ayrshare_profiles")
      .select("profile_key")
      .eq("id", profileId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);
    return getLinkedNetworks(row.profile_key);
  });
}

export async function deleteConnectionProfile(clientId: string, profileId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can manage publishing connections." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("ayrshare_profiles").delete().eq("id", profileId).eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateSocial(clientId);
    return undefined;
  });
}

/** Point a social account row at its Ayrshare platform slug + connection. */
export async function setSocialPublishing(
  clientId: string,
  strategyId: string,
  platformSlug: string,
  profileId: string | null
): Promise<ActionResult> {
  if (platformSlug && !AYRSHARE_PLATFORMS.includes(platformSlug as (typeof AYRSHARE_PLATFORMS)[number])) {
    return { ok: false, message: "Unknown Ayrshare platform." };
  }
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_strategies")
      .update({ ayrshare_platform: platformSlug, ayrshare_profile_id: profileId })
      .eq("id", strategyId)
      .eq("client_id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidateSocial(clientId);
    revalidateContent(clientId);
    return undefined;
  });
}

/** Publish (or hand to Ayrshare's scheduler) one platform version. The
 * caption + hashtags become the post; media comes from the version's media
 * slot; the account row decides which network and which connection. */
/**
 * Hand a platform version to Ayrshare.
 *
 * `replaceExisting` is the deliberate re-send. Without it this refuses any
 * output that already has a post queued at Ayrshare — which is the guard
 * that was missing when Jonny's LinkedIn posts went out twice. The old check
 * only caught outputs already marked published, so a SCHEDULED one (which by
 * definition has a live post sitting in Ayrshare's queue) sailed straight
 * through and created a second.
 */
export async function sendOutputToAyrshare(
  clientId: string,
  outputId: string,
  replaceExisting = false
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: output, error } = await supabase
      .from("content_outputs")
      .select(
        "*, social:social_strategies(id,platform,account_name,ayrshare_platform,ayrshare_profile_id), content:content_ideas(title)"
      )
      .eq("id", outputId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);

    if (output.status === "published") throw new UserFacingError("This version is already published.");

    // The re-send guard. An output holding an open handover has a real post
    // sitting in Ayrshare's queue that will publish on its own, so sending
    // again is how you get two. Refused outright unless the caller has
    // explicitly asked to replace it, in which case the queued post is
    // cancelled below before anything new goes out.
    const existingHandover = openHandover(readHistory(output.ayrshare_history));
    if (existingHandover && !replaceExisting) {
      throw new UserFacingError(
        existingHandover.mode === "scheduled" && existingHandover.scheduled_for
          ? `This version is already with Ayrshare, due to publish at ${new Date(existingHandover.scheduled_for).toLocaleString("en-GB")}. Sending it again would post it twice. Use "Check status" to see whether it has gone out, or "Replace at Ayrshare" to cancel the queued post and send a new one.`
          : `This version is already with Ayrshare and will publish on its own. Sending it again would post it twice. Use "Check status" to see whether it has gone out, or "Replace at Ayrshare" to cancel the queued post and send a new one.`
      );
    }

    if (!output.social) throw new UserFacingError("Assign a publishing account to this version first.");
    const platform = output.social.ayrshare_platform;
    if (!platform) {
      throw new UserFacingError(`"${output.social.platform}${output.social.account_name ? ` — ${output.social.account_name}` : ""}" has no Ayrshare platform set — set it on the Social tab.`);
    }
    const caption = output.caption.trim();
    if (!caption) throw new UserFacingError("Write the final caption before publishing.");
    // Master media inheritance: this version's own media if it has any,
    // otherwise the content idea's master asset. Nothing is duplicated in
    // storage — an inheriting version resolves straight to the idea's path.
    const master = await supabase
      .from("content_ideas")
      .select("media_path,media_source_url,thumbnail_path,thumbnail_source_url")
      .eq("id", output.content_id)
      .maybeSingle();
    const media = resolveMedia(output, master.data);

    // Duane's architecture point, and a real bug for scheduled posts: a
    // signed URL stored at upload time is a snapshot. What's durable is the
    // object PATH, so mint a fresh URL at the moment the post is handed over.
    // An explicitly-pasted external URL still wins — that's deliberate.
    let mediaUrl = media.sourceUrl;
    if (!mediaUrl && media.path) {
      const { data: fresh, error: signError } = await supabase.storage
        .from("client-files")
        // A year: long enough that a post scheduled months out is still
        // fetchable when the platform actually comes for it.
        .createSignedUrl(media.path, 60 * 60 * 24 * 365);
      if (signError || !fresh) {
        throw new UserFacingError(
          `Couldn't create a media link for this version (${signError?.message ?? "unknown error"}). Re-upload the file and try again.`
        );
      }
      mediaUrl = fresh.signedUrl;
    }

    // A signed URL carries no file extension, so tell Ayrshare explicitly
    // whether this is video rather than letting it guess from the path. The
    // resolved path keeps the real extension, master or override.
    const isVideo = isVideoMedia({ media_path: media.path, format: output.format }, mediaUrl);
    if (MEDIA_REQUIRED_PLATFORMS.includes(platform) && !mediaUrl) {
      throw new UserFacingError(
        `${platform} posts need media — upload it to this version, or paste a media URL for the file hosted elsewhere.`
      );
    }
    // Ayrshare fetches this URL itself, anonymously. A viewer page behind a
    // sign-in fails at publish time with something unhelpful, so refuse the
    // obvious cases here instead.
    if (output.media_source_url.trim()) {
      const verdict = inspectMediaUrl(output.media_source_url);
      if (verdict?.kind === "bad") {
        throw new UserFacingError(`That media URL can't be published: ${verdict.message}`);
      }
    }

    let profileKey: string | null = null;
    if (output.social.ayrshare_profile_id) {
      const { data: profileRow, error: profileError } = await supabase
        .from("ayrshare_profiles")
        .select("profile_key")
        .eq("id", output.social.ayrshare_profile_id)
        .single();
      if (profileError) throw new UserFacingError(profileError.message);
      profileKey = profileRow.profile_key;
    }

    // Replacing: cancel the queued post FIRST. If Ayrshare says it has
    // already gone out then the post is live and sending now would be the
    // second one — so stop, rather than warn and carry on.
    if (existingHandover && replaceExisting) {
      const cancelled = await cancelOpenHandover(supabase, output, profileKey);
      if (cancelled.alreadyPublished) {
        revalidateContent(clientId);
        throw new UserFacingError(
          `That post has already gone out on ${output.social.platform} — Ayrshare can't cancel it. Sending again would publish a second copy. Use "Check status" to pull in the live link.`
        );
      }
    }

    const post = [caption, output.hashtags.trim()].filter(Boolean).join("\n\n");

    // Jonny's YouTube version came back "Ayrshare returned 400" while the
    // same file went out to LinkedIn, Instagram and Facebook: the storage
    // logs showed no media fetch at all for that attempt, because the
    // request never got that far. YouTube is the one network Ayrshare
    // refuses without youTubeOptions.title — and it defaults visibility to
    // private, which would make a "successful" post invisible.
    const youTubeOptions = platform === "youtube" ? buildYouTubeOptions(output) : undefined;

    const scheduleDate =
      output.scheduled_at && new Date(output.scheduled_at).getTime() > Date.now() + 60_000
        ? new Date(output.scheduled_at).toISOString()
        : undefined;

    let result;
    try {
      result = await sendAyrsharePost({
        post,
        platform,
        mediaUrls: mediaUrl ? [mediaUrl] : undefined,
        isVideo,
        youTubeOptions,
        scheduleDate,
        profileKey,
      });
    } catch (err) {
      // Record everything Ayrshare said, not just the status. What's stored
      // is what Duane sees on the version, so a failed post explains itself
      // instead of needing a developer to read the logs.
      const record =
        err instanceof AyrshareError
          ? [
              err.toRecord(),
              "",
              `Media URL submitted: ${mediaUrl ?? "(none)"}`,
              `Sent as video: ${isVideo ? "yes" : "no"}`,
              ...(youTubeOptions ? [`YouTube title: ${youTubeOptions.title}`] : []),
              `Publishing connection: ${profileKey ? "client profile" : "primary Ayrshare account"}`,
              `Attempted: ${new Date().toISOString()}`,
            ].join("\n")
          : err instanceof Error
            ? err.message
            : "Publishing failed.";
      await supabase.from("content_outputs").update({ publish_error: record }).eq("id", outputId);
      revalidateContent(clientId);
      throw err;
    }

    // Append, never overwrite. The old code replaced ayrshare_post_id with
    // the new id, which is precisely why the first of Jonny's two LinkedIn
    // posts left no trace. Re-read the history because a replace above will
    // have closed the previous entry.
    const { data: current } = await supabase
      .from("content_outputs")
      .select("ayrshare_history")
      .eq("id", outputId)
      .maybeSingle();
    const history = readHistory(current?.ayrshare_history);
    const entry: HandoverEntry = {
      post_id: result.id,
      sent_at: new Date().toISOString(),
      mode: result.scheduled ? "scheduled" : "immediate",
      scheduled_for: result.scheduled ? (scheduleDate ?? null) : null,
      outcome: result.scheduled ? null : "live",
      closed_at: result.scheduled ? null : new Date().toISOString(),
    };

    if (result.scheduled) {
      await supabase
        .from("content_outputs")
        .update({
          ayrshare_post_id: result.id,
          ayrshare_history: appendHandover(history, entry),
          ayrshare_checked_at: null,
          publish_error: "",
          status: "scheduled",
        })
        .eq("id", outputId);
      revalidateContent(clientId);
      return `Handed to Ayrshare — it will publish automatically at the scheduled time. PBOS will check by itself and mark it published once it has gone out.`;
    }

    await supabase
      .from("content_outputs")
      .update({
        ayrshare_post_id: result.id,
        ayrshare_history: appendHandover(history, entry),
        ayrshare_checked_at: new Date().toISOString(),
        publish_error: "",
        status: "published",
        published_at: new Date().toISOString(),
        live_url: result.postUrl ?? output.live_url,
      })
      .eq("id", outputId);
    await rollUpMasterStatus(supabase, output.content_id);
    revalidateContent(clientId);
    return result.postUrl ? "Published — live link saved to this version." : "Published via Ayrshare.";
  });
}

/** For versions Ayrshare is publishing on a schedule: check whether it has
 * gone out yet, and if so record the live URL and mark it published. */
export async function refreshAyrshareOutput(clientId: string, outputId: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: output, error } = await supabase
      .from("content_outputs")
      .select(
        "id,content_id,status,live_url,ayrshare_post_id,ayrshare_history,social:social_strategies(ayrshare_profile_id)"
      )
      .eq("id", outputId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);
    if (!output.ayrshare_post_id) throw new UserFacingError("This version hasn't been sent to Ayrshare.");

    const profileKey = await resolveProfileKey(supabase, output.social?.ayrshare_profile_id);

    const status = await getAyrsharePostUrl(output.ayrshare_post_id, profileKey);
    if (!status.postUrl) {
      await supabase
        .from("content_outputs")
        .update({ ayrshare_checked_at: new Date().toISOString() })
        .eq("id", outputId);
      return "Still with Ayrshare — not published yet.";
    }

    // It's live, so close the open handover. That's what takes the output
    // out of "re-send would duplicate" territory and into "already posted".
    const history = closeHandover(readHistory(output.ayrshare_history), output.ayrshare_post_id, "live");

    if (output.status !== "published") {
      await supabase
        .from("content_outputs")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          live_url: status.postUrl,
          ayrshare_history: history,
          ayrshare_checked_at: new Date().toISOString(),
        })
        .eq("id", outputId);
      await rollUpMasterStatus(supabase, output.content_id);
    } else {
      await supabase
        .from("content_outputs")
        .update({
          ayrshare_history: history,
          ayrshare_checked_at: new Date().toISOString(),
          ...(output.live_url ? {} : { live_url: status.postUrl }),
        })
        .eq("id", outputId);
    }
    revalidateContent(clientId);
    return "Published — live link saved to this version.";
  });
}

/**
 * The title YouTube shows above the video. The master idea's title is the
 * natural one — it's what the team named the piece — falling back to the
 * first line of the caption. Trimmed to Ayrshare's 100-character limit.
 * Anything with "short" in the version's format posts as a YouTube Short.
 */
function buildYouTubeOptions(output: {
  caption: string;
  format: string;
  content: { title: string } | null;
}): AyrshareYouTubeOptions {
  const fromMaster = (output.content?.title ?? "").trim();
  const fromCaption = output.caption
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  const raw = fromMaster || fromCaption;
  if (!raw) throw new UserFacingError("YouTube needs a title — give the master idea a title before publishing.");
  const title = raw.length > YOUTUBE_TITLE_MAX ? `${raw.slice(0, YOUTUBE_TITLE_MAX - 1).trimEnd()}…` : raw;
  return {
    title,
    visibility: "public",
    ...(/short/i.test(output.format) ? { shorts: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Reconciliation and performance (Duane, 3 Sep 2026)
// ---------------------------------------------------------------------------

/** Profile key for a social account row, or null for the primary account. */
async function profileKeyFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string | null
): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await supabase.from("ayrshare_profiles").select("profile_key").eq("id", profileId).single();
  return data?.profile_key ?? null;
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Recover Ayrshare post ids for versions that were handed over but never
 * recorded the id — every post sent through a client's own profile before
 * the Profile-Key response shape was handled. Without the id there is no
 * "Check status", no "With Ayrshare" pill and no performance pull.
 *
 * Matching, in order of confidence: the live URL Ayrshare reported; then
 * the same platform with the identical post text; then the same platform
 * with the same opening line. Each Ayrshare record is claimed once per
 * platform. Read-only at Ayrshare — only PBOS rows change.
 */
export async function reconcileAyrshareHistory(
  clientId: string
): Promise<ActionResult<{ matched: number; unmatched: number; published: number }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: outputs, error } = await supabase
      .from("content_outputs")
      .select("id,content_id,platform,caption,hashtags,status,live_url,ayrshare_post_id,social:social_strategies(ayrshare_platform,ayrshare_profile_id)")
      .eq("client_id", clientId)
      .eq("ayrshare_post_id", "")
      .in("status", ["scheduled", "published"]);
    if (error) throw new UserFacingError(error.message);

    const candidates = (outputs ?? []).filter((o) => o.social?.ayrshare_platform);
    if (candidates.length === 0) {
      throw new UserFacingError("Every scheduled or published version with a publishing account already has its Ayrshare id.");
    }

    // One history fetch per profile (plus one for the primary account).
    const historyByProfile = new Map<string, AyrshareHistoryRecord[]>();
    const claimed = new Set<string>();
    let matched = 0;
    let published = 0;

    for (const output of candidates) {
      const profileId = output.social?.ayrshare_profile_id ?? null;
      const key = profileId ?? "__primary__";
      if (!historyByProfile.has(key)) {
        historyByProfile.set(key, await getAyrshareHistory(await profileKeyFor(supabase, profileId)));
      }
      const history = historyByProfile.get(key) ?? [];
      const platform = output.social!.ayrshare_platform as string;
      const postText = squash([output.caption.trim(), output.hashtags.trim()].filter(Boolean).join("\n\n"));
      const firstLine = squash(output.caption).slice(0, 60);
      const onPlatform = (r: AyrshareHistoryRecord) =>
        !claimed.has(`${r.id}:${platform}`) &&
        (r.platforms.includes(platform) || r.postIds.some((p) => p.platform === platform));

      const record =
        (output.live_url &&
          history.find((r) => onPlatform(r) && r.postIds.some((p) => p.postUrl && p.postUrl === output.live_url))) ||
        history.find((r) => onPlatform(r) && squash(r.post) === postText) ||
        (firstLine.length >= 20 && history.find((r) => onPlatform(r) && squash(r.post).startsWith(firstLine))) ||
        null;
      if (!record) continue;

      claimed.add(`${record.id}:${platform}`);
      const live = record.postIds.find((p) => p.platform === platform && p.postUrl)?.postUrl ?? null;
      const patch: Database["public"]["Tables"]["content_outputs"]["Update"] = { ayrshare_post_id: record.id };
      if (live && !output.live_url) patch.live_url = live;
      if (live && output.status !== "published") {
        patch.status = "published";
        patch.published_at = record.scheduledAt ?? record.createdAt ?? new Date().toISOString();
        published += 1;
      }
      const { error: updateError } = await supabase.from("content_outputs").update(patch).eq("id", output.id);
      if (updateError) throw new UserFacingError(updateError.message);
      if (patch.status === "published") await rollUpMasterStatus(supabase, output.content_id);
      matched += 1;
    }

    revalidateContent(clientId);
    revalidatePath(`/clients/${clientId}/metrics`);
    return { matched, unmatched: candidates.length - matched, published };
  });
}

interface PerformanceTarget {
  id: string;
  platform: string;
  ayrshare_post_id: string;
  social: { ayrshare_platform: string; ayrshare_profile_id: string | null } | null;
}

async function pullOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  output: PerformanceTarget,
  profileKeys: Map<string, string | null>
): Promise<void> {
  const platform = output.social?.ayrshare_platform;
  if (!platform) throw new UserFacingError("This version has no Ayrshare platform on its publishing account.");
  const profileId = output.social?.ayrshare_profile_id ?? null;
  const key = profileId ?? "__primary__";
  if (!profileKeys.has(key)) profileKeys.set(key, await profileKeyFor(supabase, profileId));

  const stats = await getAyrsharePostAnalytics(output.ayrshare_post_id, platform, profileKeys.get(key) ?? null);
  const { error } = await supabase
    .from("content_outputs")
    .update({
      reach: stats.reach,
      views: stats.views,
      engagement: stats.engagement,
      likes: stats.likes,
      comments: stats.comments,
      shares: stats.shares,
      analytics_at: new Date().toISOString(),
      analytics_raw: stats.raw as Json,
      ...(stats.postUrl ? { live_url: stats.postUrl } : {}),
    })
    .eq("id", output.id);
  if (error) throw new UserFacingError(error.message);
}

/** Pull one published version's numbers from Ayrshare. Read-only there. */
export async function pullOutputPerformance(clientId: string, outputId: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data: output, error } = await supabase
      .from("content_outputs")
      .select("id,platform,ayrshare_post_id,social:social_strategies(ayrshare_platform,ayrshare_profile_id)")
      .eq("id", outputId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);
    if (!output.ayrshare_post_id) {
      throw new UserFacingError("This version has no Ayrshare post id — use \"Match posts with Ayrshare\" on the Metrics tab first.");
    }
    await pullOne(supabase, output, new Map());
    revalidateContent(clientId);
    revalidatePath(`/clients/${clientId}/metrics`);
    return "Performance updated from Ayrshare.";
  });
}

/**
 * Pull performance for every published version of this client that has an
 * Ayrshare id — least recently pulled first, a batch at a time so a client
 * with a long back catalogue stays within one request. Each version's
 * failure is reported, not fatal: TikTok and YouTube say nothing for the
 * first day or two after publishing.
 */
export async function pullClientPerformance(
  clientId: string
): Promise<ActionResult<{ updated: number; failed: { label: string; message: string }[]; remaining: number }>> {
  const BATCH = 8;
  return runAction(async () => {
    const supabase = await createClient();
    const { data: outputs, error } = await supabase
      .from("content_outputs")
      .select("id,platform,ayrshare_post_id,analytics_at,content:content_ideas(title),social:social_strategies(ayrshare_platform,ayrshare_profile_id)")
      .eq("client_id", clientId)
      .eq("status", "published")
      .neq("ayrshare_post_id", "")
      .order("analytics_at", { ascending: true, nullsFirst: true });
    if (error) throw new UserFacingError(error.message);
    const targets = (outputs ?? []).filter((o) => o.social?.ayrshare_platform);
    if (targets.length === 0) {
      throw new UserFacingError("No published versions carry an Ayrshare post id yet — run \"Match posts with Ayrshare\" first, or publish through PBOS.");
    }

    const batch = targets.slice(0, BATCH);
    const profileKeys = new Map<string, string | null>();
    let updated = 0;
    const failed: { label: string; message: string }[] = [];
    // Small parallelism: quick enough for a dozen posts, gentle on Ayrshare.
    for (let i = 0; i < batch.length; i += 4) {
      await Promise.all(
        batch.slice(i, i + 4).map(async (output) => {
          try {
            await pullOne(supabase, output, profileKeys);
            updated += 1;
          } catch (err) {
            failed.push({
              label: `${output.content?.title ?? "Content"} · ${output.platform}`,
              message: err instanceof Error ? err.message : "Unknown error",
            });
          }
        })
      );
    }

    revalidateContent(clientId);
    revalidatePath(`/clients/${clientId}/metrics`);
    return { updated, failed, remaining: targets.length - batch.length };
  });
}

/** Don't re-ask Ayrshare about the same post more often than this. */
const RECONCILE_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Ask Ayrshare whether any handed-over post has actually gone out, and mark
 * it published if so.
 *
 * This is the root of the duplicate problem rather than a convenience. A
 * scheduled post published on its own, but PBOS kept showing it as pending
 * because the only way to find out was to press "Check status" on that one
 * row. So the screen said "not published" about a post that was live, and
 * the button on it read "Publish now" — which made sending a second one the
 * obvious thing to do. Seventeen of Jonny's outputs were sitting in exactly
 * that state.
 *
 * Runs from the Content tab on load. Read-only at Ayrshare, throttled per
 * output, and it only ever moves a version forwards to published.
 */
export async function reconcileDueHandovers(clientId: string): Promise<ActionResult<number>> {
  return runAction(async () => {
    const supabase = await createClient();
    const cutoff = new Date(Date.now() - RECONCILE_THROTTLE_MS).toISOString();

    const { data: due, error } = await supabase
      .from("content_outputs")
      .select(
        "id,content_id,status,live_url,scheduled_at,ayrshare_post_id,ayrshare_history,ayrshare_checked_at,social:social_strategies(ayrshare_profile_id)"
      )
      .eq("client_id", clientId)
      .neq("status", "published")
      .neq("ayrshare_post_id", "")
      .or(`ayrshare_checked_at.is.null,ayrshare_checked_at.lt.${cutoff}`);
    if (error) throw new UserFacingError(error.message);

    // Only posts whose moment has passed can have gone out. Anything still
    // in the future is correctly showing as pending.
    const ready = (due ?? []).filter(
      (row) => !row.scheduled_at || new Date(row.scheduled_at).getTime() <= Date.now()
    );
    if (ready.length === 0) return 0;

    let published = 0;
    for (const row of ready) {
      try {
        const profileKey = await resolveProfileKey(supabase, row.social?.ayrshare_profile_id);
        const status = await getAyrsharePostUrl(row.ayrshare_post_id, profileKey);
        if (!status.postUrl) {
          await supabase
            .from("content_outputs")
            .update({ ayrshare_checked_at: new Date().toISOString() })
            .eq("id", row.id);
          continue;
        }
        await supabase
          .from("content_outputs")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            live_url: row.live_url || status.postUrl,
            ayrshare_history: closeHandover(readHistory(row.ayrshare_history), row.ayrshare_post_id, "live"),
            ayrshare_checked_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await rollUpMasterStatus(supabase, row.content_id);
        published += 1;
      } catch {
        // One unreachable post mustn't stop the rest. Stamp it so a
        // persistently failing row doesn't get retried on every page load.
        await supabase
          .from("content_outputs")
          .update({ ayrshare_checked_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    if (published > 0) revalidateContent(clientId);
    return published;
  });
}
