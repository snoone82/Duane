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
