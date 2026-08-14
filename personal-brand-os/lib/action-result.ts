import { isNextRedirectError, friendlySaveError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/**
 * Shared safety net for every Server Action in lib/actions/: catches an
 * unexpected thrown error (network failure, an unfamiliar Supabase error)
 * and resolves it to a friendly ActionResult instead of throwing past the
 * Server Action boundary into Next's generic error page. redirect()/
 * notFound() are explicitly rethrown, never swallowed.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: friendlySaveError(message) };
  }
}
