import { cookies } from "next/headers";
import { UserFacingError } from "@/lib/errors";

/**
 * Read-only "View as User" (Duane's brief, 29 Aug 2026).
 *
 * This is deliberately NOT impersonation. The admin's session stays the
 * admin's session — no password is involved, no token is issued for the
 * other person, and nothing is ever done in their name. PBOS simply renders
 * the portal using the selected user's permissions, so support and testing
 * can see exactly what that person sees.
 *
 * Because the underlying session is still an admin's, every write would
 * otherwise succeed. So the preview is enforced twice over: the UI hides
 * write controls, and every portal write action calls assertNotPreviewing()
 * before it touches anything. The guard fails closed — if the cookie is
 * present, the write is refused, full stop.
 */

export const PREVIEW_COOKIE = "pbos_preview_user";

export async function getPreviewUserId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(PREVIEW_COOKIE)?.value?.trim();
  return value ? value : null;
}

const PREVIEW_MESSAGE =
  "You're previewing this portal as someone else, which is read-only. Exit the preview to make changes.";

/**
 * Called at the top of every portal write action. While a preview is
 * active, nothing can be approved, uploaded, completed, changed, emailed or
 * published — Duane's requirement that a preview can never look as though
 * the client did something.
 *
 * Returns a refusal to hand straight back, rather than throwing, so the
 * message reaches the screen the same way every other guard's does.
 */
export async function previewBlock(): Promise<{ ok: false; message: string } | null> {
  return (await getPreviewUserId()) ? { ok: false, message: PREVIEW_MESSAGE } : null;
}

/** Throwing form, for use inside a runAction body. */
export async function assertNotPreviewing(): Promise<void> {
  if (await getPreviewUserId()) throw new UserFacingError(PREVIEW_MESSAGE);
}
