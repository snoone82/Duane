"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { previewBlock } from "@/lib/preview";
import { UserFacingError } from "@/lib/errors";
import { env } from "@/lib/env";

/** Create a portal login for a client entirely from inside the app — no
 * Supabase dashboard involved (Duane's "handled through the dashboard" ask).
 * Uses ordinary anon-key signUp on a throwaway client (so the admin's own
 * session is untouched, and no service-role key is ever needed): random
 * unguessable password, role set to client, account linked to this client,
 * and a set-your-password email sent to the client. */
export async function createPortalLogin(clientId: string, emailRaw: string): Promise<ActionResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "That doesn't look like an email address." };

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can create portal logins." };

  return runAction(async () => {
    // Bare client: same anon key the login page uses, but with no session
    // persistence, so signing the new user up doesn't sign the admin out.
    const bare = createBareClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signUpData, error: signUpError } = await bare.auth.signUp({
      email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`, // never used — they set their own via the email
    });
    if (signUpError) {
      throw new UserFacingError(
        signUpError.message.toLowerCase().includes("signup")
          ? "Sign-ups are disabled in Supabase Auth settings — enable email sign-ups, or create the account from the Supabase dashboard."
          : signUpError.message
      );
    }
    const newUser = signUpData.user;
    if (!newUser) throw new UserFacingError("The account wasn't created — try again.");
    if (!newUser.identities || newUser.identities.length === 0) {
      throw new UserFacingError("An account with that email already exists — set its role to Client on the Team & access page, then link it here.");
    }

    // The handle_new_user trigger creates the profile row with the default
    // member role; flip it to client as the admin. Small retry in case the
    // row lags a beat behind the auth API response.
    const supabase = await createClient();
    let flipped = false;
    for (let attempt = 0; attempt < 4 && !flipped; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400));
      const { data } = await supabase.from("profiles").update({ role: "client" }).eq("id", newUser.id).select("id");
      flipped = (data?.length ?? 0) > 0;
    }
    if (!flipped) throw new UserFacingError("The login was created but its role couldn't be set — set it to Client on the Team & access page.");

    const { error: linkError } = await supabase.from("clients").update({ portal_user_id: newUser.id }).eq("id", clientId);
    if (linkError) throw new UserFacingError(`The login was created but couldn't be linked: ${linkError.message}`);

    // Password-setup email, using the existing reset flow.
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://personal-brand-os-beta.vercel.app";
    const { error: resetError } = await bare.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password/confirm`,
    });
    if (resetError) {
      throw new UserFacingError(
        `Portal access is set up, but the password email didn't send (${resetError.message}). Ask them to use "Forgot password?" on the sign-in page instead.`
      );
    }

    revalidatePath(`/clients/${clientId}/overview`);
    revalidatePath("/team");
    return undefined;
  });
}

/** Link (or unlink, with null) a client-role account to a client record so
 * that account sees this client's portal. Admin-only — RLS would let any
 * assigned member update clients, but who gets portal access is an
 * admin decision. */
export async function setPortalUser(clientId: string, userId: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can manage portal access." };

  return runAction(async () => {
    const supabase = await createClient();

    if (userId) {
      const { data: candidate } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (candidate?.role !== "client") throw new UserFacingError("Portal access is only for client-role accounts.");
    }

    const { error } = await supabase.from("clients").update({ portal_user_id: userId }).eq("id", clientId);
    if (error) throw new UserFacingError(error.message);
    revalidatePath(`/clients/${clientId}/overview`);
    return undefined;
  });
}

/** Clients submit their own content ideas from the portal (Duane batch 9).
 * RLS pins the idea to their own client at status 'idea' and stamps them as
 * creator; the team picks it up from the normal pipeline afterwards. */
export async function portalCreateContentIdea(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { ok: false, message: "Give the idea a title." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UserFacingError("Not signed in.");

    // The client's own record, via the same RLS-scoped lookup the portal uses.
    const { data: client } = await supabase.from("clients").select("id").limit(1).maybeSingle();
    if (!client) throw new UserFacingError("Your account isn't linked to a client profile yet.");

    const { error } = await supabase.from("content_ideas").insert({
      client_id: client.id,
      title,
      body,
      status: "idea",
      created_by: user.id,
    });
    if (error) throw new UserFacingError(error.message);
    revalidatePath("/portal/content");
    revalidatePath("/portal");
    return undefined;
  });
}

/** Edit an idea the client submitted, while it's still just an idea. */
export async function portalUpdateContentIdea(ideaId: string, field: "title" | "body", value: string): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  if (field === "title" && !value.trim()) return { ok: false, message: "The title can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const patch = field === "title" ? { title: value.trim() } : { body: value };
    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update(patch)
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new UserFacingError(error.message);
    if (!updated) throw new UserFacingError("This idea is now with the team — it can't be edited here any more.");
    revalidatePath("/portal/content");
    return undefined;
  });
}

/** Portal-side final-content approval (Duane's workflow §2). RLS + the
 * enforce_content_approval_transition trigger restrict this to the linked
 * client, only on ready_for_approval items, and only these fields — the
 * server action is just the convenient front door. */
export async function portalRespondContent(
  ideaId: string,
  decision: "approve" | "request_changes",
  comments: string
): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  if (decision === "request_changes" && !comments.trim()) {
    return { ok: false, message: "Say what needs to change so the team can act on it." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update({
        status: decision === "approve" ? "ready_to_schedule" : "changes_requested",
        approval_comments: comments.trim(),
      })
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new UserFacingError(error.message);
    if (!updated) throw new UserFacingError("This item is no longer awaiting your approval.");
    // Reopening the linked production Action, and ticking/un-ticking its
    // "Complete internal review" / "Send for client approval" / "Content
    // approved" checklist items to match, happens in the
    // reopen_action_on_changes_requested trigger (migration 0031) — portal
    // users have no UPDATE rights on the internal production Action, so it
    // can't be done here the way lib/actions/content.ts's
    // syncProductionChecklist does it for every admin-side write.

    revalidatePath("/portal/content");
    return undefined;
  });
}

/**
 * The client corrects the copy for one platform, in place.
 *
 * Duane's split at approval: a change to the VIDEO goes back to the team
 * through Request changes; a change to the WORDS the client just makes. So
 * this writes the live platform version — no duplicate, no parallel draft —
 * and whatever is saved at the moment they approve is what gets scheduled.
 *
 * Goes through portal_update_output_copy (migration 0056) rather than a
 * direct update: RLS can gate the row but not the column, and a policy wide
 * enough to allow a caption edit would also allow the client to change the
 * schedule or the status. The function writes caption and nothing else.
 */
export async function portalUpdateOutputCopy(outputId: string, caption: string): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("portal_update_output_copy", {
      output_id: outputId,
      new_caption: caption.trim(),
    });
    if (error) throw new UserFacingError(error.message);
    revalidatePath("/portal/content");
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Developing an idea into production (Duane + Jonny, 24 Sep 2026)
// ---------------------------------------------------------------------------

/** What a client may set while developing their own idea. Deliberately not
 * the admin field list: dates, priority, owner and approver stay internal,
 * and the database enforces that independently in
 * enforce_content_approval_transition. */
const DEVELOP_FIELDS = ["title", "hook", "body", "notes", "pillar_id", "audience_id"] as const;
type DevelopField = (typeof DEVELOP_FIELDS)[number];

/**
 * Save one field while the client develops their own idea.
 *
 * Separate from portalUpdateContentIdea (title/body only) rather than
 * widening it, because the two answer different questions: that one is "tidy
 * up what I submitted", this one is "turn it into something producible".
 */
export async function portalDevelopIdeaField(
  ideaId: string,
  field: DevelopField,
  value: string
): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  if (!DEVELOP_FIELDS.includes(field)) return { ok: false, message: "That field can't be edited here." };
  if (field === "title" && !value.trim()) return { ok: false, message: "The title can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    // Empty select means "clear it" for the two reference fields; a blank
    // pillar is a real state, not a validation failure.
    const patch =
      field === "pillar_id" || field === "audience_id"
        ? { [field]: value || null }
        : { [field]: field === "title" ? value.trim() : value };
    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update(patch as never)
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new UserFacingError(error.message);
    if (!updated) throw new UserFacingError("This is now with the team — it can't be edited here any more.");
    revalidatePath("/portal/content");
    return undefined;
  });
}

/** Attach master media or a thumbnail the client uploaded to their own idea.
 * The file itself goes browser → storage; this records where it landed. */
export async function portalAttachIdeaMedia(
  ideaId: string,
  kind: "media" | "thumbnail",
  storagePath: string
): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  if (kind !== "media" && kind !== "thumbnail") return { ok: false, message: "Unknown media slot." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage.from("client-files").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    const patch =
      kind === "media"
        ? { media_path: storagePath, media_url: signed?.signedUrl ?? null }
        : { thumbnail_path: storagePath, thumbnail_url: signed?.signedUrl ?? null };
    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update(patch as never)
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new UserFacingError(error.message);
    if (!updated) throw new UserFacingError("This is now with the team — media can't be changed here any more.");
    revalidatePath("/portal/content");
    return undefined;
  });
}

/**
 * "Send to production" — the client says this is no longer just an idea.
 *
 * The same record moves to approved_production; nothing is copied, which is
 * the whole point of the request. From here the RLS USING clause stops
 * matching, so it becomes read-only to the client and picks up in the team's
 * pipeline exactly where an internally-progressed item would.
 */
export async function portalSendIdeaToProduction(ideaId: string): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;

  return runAction(async () => {
    const supabase = await createClient();
    const { data: idea, error: readError } = await supabase
      .from("content_ideas")
      .select("id,title,body,hook,media_path")
      .eq("id", ideaId)
      .maybeSingle();
    if (readError) throw new UserFacingError(readError.message);
    if (!idea) throw new UserFacingError("That idea is no longer yours to send.");
    if (!idea.title.trim()) throw new UserFacingError("Give it a title before sending it to production.");
    // Something to produce FROM. A title alone gives the team nothing to
    // work with, and a silent empty brief wastes a round trip.
    if (!idea.body.trim() && !idea.hook.trim() && !idea.media_path) {
      throw new UserFacingError(
        "Add the content first — some copy, a hook, or the video or image you want produced — then send it."
      );
    }

    const { data: updated, error } = await supabase
      .from("content_ideas")
      .update({ status: "approved_production" })
      .eq("id", ideaId)
      .select("id")
      .maybeSingle();
    if (error) throw new UserFacingError(error.message);
    if (!updated) throw new UserFacingError("That idea is no longer yours to send.");

    revalidatePath("/portal/content");
    revalidatePath("/");
    return undefined;
  });
}
