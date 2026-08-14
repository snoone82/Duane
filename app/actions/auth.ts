"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlySignInError, friendlySignupError, isNextRedirectError } from "@/lib/errors";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; isExistingAccount?: boolean };

/**
 * Converts the current anonymous user into a permanent account. The user ID
 * never changes, so every audit response already written stays attached.
 * Do not replace this with sign-up + copy-data — see the brief.
 */
export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<ActionResult> {
  try {
    if (input.password.length < 8) {
      return { ok: false, message: "Password needs to be at least 8 characters." };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      email: input.email.trim(),
      password: input.password,
      data: { full_name: input.fullName.trim() },
    });

    if (error) {
      const { message, isExistingAccount } = friendlySignupError(error.message);
      return { ok: false, message, isExistingAccount };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("createAccount: unexpected error —", error);
    const { message, isExistingAccount } = friendlySignupError(undefined);
    return { ok: false, message, isExistingAccount };
  }
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      return { ok: false, message: friendlySignInError(error.message) };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("signIn: unexpected error —", error);
    return { ok: false, message: friendlySignInError(undefined) };
  }
}

/**
 * Records a deletion request against the current user's profile — it does
 * NOT actually delete anything. Hard-deleting an auth.users row needs
 * Supabase's admin API (a service-role key), which this app deliberately
 * doesn't have anywhere (see README's RLS/security notes) — introducing
 * one now, just for this, would be a bigger security trade-off than the
 * feature is worth. Duane actions the actual deletion manually from the
 * Supabase dashboard once he sees the request. Flagging this compromise in
 * the code, not hiding it.
 *
 * Calls a narrow security-definer RPC (request_account_deletion, see
 * supabase/migrations) rather than updating profiles directly — that table
 * has no UPDATE policy for authenticated users at all, deliberately, so a
 * client can never rewrite its own email/is_anonymous/full_name. The RPC
 * only ever touches deletion_requested_at, on exactly the caller's own row.
 */
export async function requestAccountDeletion(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, message: "Your session's expired — refresh and try again." };
    }

    const { error } = await supabase.rpc("request_account_deletion");

    if (error) {
      return { ok: false, message: "We couldn't record that just now. Try again." };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("requestAccountDeletion: unexpected error —", error);
    return { ok: false, message: "We couldn't record that just now. Try again." };
  }
}

export async function signOut(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { ok: false, message: "We couldn't sign you out just now. Try again." };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("signOut: unexpected error —", error);
    return { ok: false, message: "We couldn't sign you out just now. Try again." };
  }
}
