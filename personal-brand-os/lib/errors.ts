/**
 * Turns Supabase/Postgres errors into plain-language messages instead of
 * surfacing a raw error string. Every Server Action in lib/actions/ routes
 * its catch block through here.
 */

/**
 * Next.js's redirect()/notFound() unwind by throwing a special error tagged
 * with a `digest` like "NEXT_REDIRECT;...". A try/catch around a Server
 * Action body must rethrow this rather than swallow it, or the navigation
 * silently fails.
 */
export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** An error whose message is already written for the person using the app —
 * runAction shows it verbatim instead of masking it behind the generic
 * "didn't save" line. Use for integration errors (Ayrshare etc.) where the
 * real reason is the fix. */
export class UserFacingError extends Error {}

export function friendlySaveError(message: string | undefined | null): string {
  const lower = (message ?? "").toLowerCase();

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "You don't have access to make that change. If this client should be yours, ask an admin to check your assignment.";
  }

  if (lower.includes("duplicate key")) {
    return "That already exists — refresh and try again.";
  }

  return "That didn't save. Check your connection and try again — nothing else on the page was affected.";
}

export function friendlySignInError(message: string | undefined | null): string {
  const lower = (message ?? "").toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "That email and password don't match. Check them and try again.";
  }

  return "Couldn't sign you in just now. Check your details and try again.";
}
