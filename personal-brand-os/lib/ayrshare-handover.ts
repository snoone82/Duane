import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { deleteAyrsharePost } from "@/lib/ayrshare";
import { closeHandover, openHandover, readHistory } from "@/lib/ayrshare-history";

/**
 * The server half of handover handling — the part that talks to Ayrshare.
 * The pure record functions live in lib/ayrshare-history.ts so the Content
 * row can use them in the browser without pulling the API client in.
 *
 * Duane, on Jonny: the same post went out twice on LinkedIn. PBOS had sent
 * two publish requests and Ayrshare had done exactly as asked. Two things
 * made that possible and both are closed here:
 *
 *   1. Unscheduling took a post off the PBOS calendar but never told
 *      Ayrshare, so the queued post still fired.
 *   2. Re-sending overwrote ayrshare_post_id, so the first post became
 *      invisible to PBOS — impossible to cancel, or even to notice.
 *
 * This sits in its own module rather than in either action file because
 * publishing.ts and content.ts already import from each other, and a third
 * edge would close the cycle.
 */

/** The profile key for an output's publishing account, or null for the
 * primary Ayrshare account. */
export async function resolveProfileKey(
  supabase: SupabaseServerClient,
  ayrshareProfileId: string | null | undefined
): Promise<string | null> {
  if (!ayrshareProfileId) return null;
  const { data } = await supabase
    .from("ayrshare_profiles")
    .select("profile_key")
    .eq("id", ayrshareProfileId)
    .maybeSingle();
  return data?.profile_key ?? null;
}

export interface CancelResult {
  /** Nothing was queued — safe to proceed. */
  nothingQueued: boolean;
  /** The queued post had already gone out. Sending again WOULD duplicate. */
  alreadyPublished: boolean;
  postId: string | null;
  message: string;
}

/**
 * Cancel whatever this output has queued at Ayrshare and record it.
 *
 * `alreadyPublished` is the important case: the post is live, so there is
 * nothing to cancel and anything sent now is a second post. Callers must
 * treat it as a stop, not a warning.
 */
export async function cancelOpenHandover(
  supabase: SupabaseServerClient,
  output: { id: string; ayrshare_post_id: string | null; ayrshare_history: Json | null },
  profileKey: string | null
): Promise<CancelResult> {
  const history = readHistory(output.ayrshare_history);
  const open = openHandover(history);
  const postId = open?.post_id || output.ayrshare_post_id || null;

  if (!postId) {
    return { nothingQueued: true, alreadyPublished: false, postId: null, message: "Nothing was queued at Ayrshare." };
  }

  const result = await deleteAyrsharePost(postId, profileKey);

  if (result.alreadyPublished) {
    // Record it as live rather than cancelled — that is what actually
    // happened, and it is what stops the next caller re-sending.
    await supabase
      .from("content_outputs")
      .update({ ayrshare_history: closeHandover(history, postId, "live") })
      .eq("id", output.id);
    return { nothingQueued: false, alreadyPublished: true, postId, message: result.message };
  }

  await supabase
    .from("content_outputs")
    .update({
      ayrshare_history: closeHandover(history, postId, "cancelled"),
      ayrshare_post_id: "",
    })
    .eq("id", output.id);

  return { nothingQueued: false, alreadyPublished: false, postId, message: result.message };
}
