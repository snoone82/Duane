"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
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
    const origin = (await headers()).get("origin") ?? "https://personal-brand-os-beta.vercel.app";
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
    // Reopening the linked production Action happens in the
    // reopen_action_on_changes_requested trigger — portal users have no
    // UPDATE rights on actions, so it can't be done here.

    revalidatePath("/portal/content");
    return undefined;
  });
}
