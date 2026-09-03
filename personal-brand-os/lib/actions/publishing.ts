"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { resolveMediaUrl, inspectMediaUrl, isVideoMedia } from "@/lib/media-source";
import { rollUpMasterStatus } from "@/lib/actions/content";
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
} from "@/lib/ayrshare";

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
export async function sendOutputToAyrshare(clientId: string, outputId: string): Promise<ActionResult<string>> {
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
    if (!output.social) throw new UserFacingError("Assign a publishing account to this version first.");
    const platform = output.social.ayrshare_platform;
    if (!platform) {
      throw new UserFacingError(`"${output.social.platform}${output.social.account_name ? ` — ${output.social.account_name}` : ""}" has no Ayrshare platform set — set it on the Social tab.`);
    }
    const caption = output.caption.trim();
    if (!caption) throw new UserFacingError("Write the final caption before publishing.");
    // Duane's architecture point, and a real bug for scheduled posts: the
    // signed URL stored at upload time is a snapshot. What's durable is the
    // object's PATH, so mint a fresh URL at the moment the post is handed
    // over. An explicitly-pasted external URL still wins — that's a
    // deliberate override.
    let mediaUrl = resolveMediaUrl(output);
    if (!output.media_source_url.trim() && output.media_path) {
      const { data: fresh, error: signError } = await supabase.storage
        .from("client-files")
        // A year: long enough that a post scheduled months out is still
        // fetchable when the platform actually comes for it.
        .createSignedUrl(output.media_path, 60 * 60 * 24 * 365);
      if (signError || !fresh) {
        throw new UserFacingError(
          `Couldn't create a media link for this version (${signError?.message ?? "unknown error"}). Re-upload the file and try again.`
        );
      }
      mediaUrl = fresh.signedUrl;
    }

    // A signed URL carries no file extension, so tell Ayrshare explicitly
    // whether this is video rather than letting it guess from the path.
    const isVideo = isVideoMedia(output, mediaUrl);
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

    if (result.scheduled) {
      await supabase
        .from("content_outputs")
        .update({ ayrshare_post_id: result.id, publish_error: "", status: "scheduled" })
        .eq("id", outputId);
      revalidateContent(clientId);
      return `Handed to Ayrshare — it will publish automatically at the scheduled time. Use "Check status" afterwards to pull in the live link.`;
    }

    await supabase
      .from("content_outputs")
      .update({
        ayrshare_post_id: result.id,
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
      .select("id,content_id,status,live_url,ayrshare_post_id,social:social_strategies(ayrshare_profile_id)")
      .eq("id", outputId)
      .eq("client_id", clientId)
      .single();
    if (error) throw new UserFacingError(error.message);
    if (!output.ayrshare_post_id) throw new UserFacingError("This version hasn't been sent to Ayrshare.");

    let profileKey: string | null = null;
    if (output.social?.ayrshare_profile_id) {
      const { data: profileRow } = await supabase
        .from("ayrshare_profiles")
        .select("profile_key")
        .eq("id", output.social.ayrshare_profile_id)
        .single();
      profileKey = profileRow?.profile_key ?? null;
    }

    const status = await getAyrsharePostUrl(output.ayrshare_post_id, profileKey);
    if (!status.postUrl) return "Still with Ayrshare — not published yet.";

    if (output.status !== "published") {
      await supabase
        .from("content_outputs")
        .update({ status: "published", published_at: new Date().toISOString(), live_url: status.postUrl })
        .eq("id", outputId);
      await rollUpMasterStatus(supabase, output.content_id);
    } else if (!output.live_url) {
      await supabase.from("content_outputs").update({ live_url: status.postUrl }).eq("id", outputId);
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
