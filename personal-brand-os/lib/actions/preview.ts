"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { PREVIEW_COOKIE } from "@/lib/preview";

/**
 * Start a read-only preview of a client user's portal (Duane's View as
 * User). No password, no token, no session swap — the cookie only tells
 * PBOS whose permissions to render with, and every portal write is refused
 * while it's set.
 */
export async function startPreview(userId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can preview a client's portal." };

  return runAction(async () => {
    const supabase = await createClient();

    // The target must genuinely be a portal user of a client this admin can
    // see — never an arbitrary account id pasted into the action.
    const [{ data: principal }, { data: membership }] = await Promise.all([
      supabase.from("clients").select("id").eq("portal_user_id", userId).maybeSingle(),
      supabase.from("client_members").select("id,status").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle(),
    ]);
    if (!principal && !membership) {
      throw new UserFacingError("That person doesn't have an active portal login for a client you have access to.");
    }

    const store = await cookies();
    store.set(PREVIEW_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Short-lived by design: a forgotten preview shouldn't quietly block
      // portal writes tomorrow. Two hours is plenty for testing or support.
      maxAge: 60 * 60 * 2,
    });
    return undefined;
  });
}

export async function endPreview(): Promise<ActionResult> {
  return runAction(async () => {
    const store = await cookies();
    store.delete(PREVIEW_COOKIE);
    return undefined;
  });
}
