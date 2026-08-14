/**
 * Turns Supabase/Postgres errors into plain-language messages in the app's
 * voice. Never surface a raw Supabase error string to a user — route
 * everything through here first.
 */

/**
 * Next.js's redirect() (and notFound()) unwind out of a Server Action or
 * Server Component by throwing a special error tagged with a `digest` like
 * "NEXT_REDIRECT;...". A try/catch wrapped around Server Action bodies must
 * rethrow this rather than swallow it — otherwise the navigation silently
 * fails and the user just sees a generic error instead of moving on.
 * None of app/actions/audit.ts or app/actions/auth.ts call redirect()
 * themselves today (navigation there is client-side via router.push), but
 * their catch blocks check this anyway so it stays safe if that changes.
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

const IMMUTABILITY_HINTS = [
  "completed and cannot be modified", // audits, clear_plans
  "responses cannot be added or changed", // audit_responses
  "and cannot be modified", // goals (any terminal status, not just completed)
  "check-ins cannot be added or changed", // checkins
];

const GOAL_SLOT_LIMIT_HINTS = ["active primary goal is allowed", "active supporting goals are allowed"];

export function isImmutabilityError(message: string | undefined | null): boolean {
  if (!message) return false;
  return IMMUTABILITY_HINTS.some((hint) => message.includes(hint));
}

export function isGoalSlotLimitError(message: string | undefined | null): boolean {
  if (!message) return false;
  return GOAL_SLOT_LIMIT_HINTS.some((hint) => message.includes(hint));
}

export function friendlySaveError(message: string | undefined | null): string {
  if (isImmutabilityError(message)) {
    // The database is doing its job — this is already a locked-in
    // snapshot. This shouldn't normally be reachable from the UI, but if it
    // is, tell the truth plainly rather than a generic failure message.
    return "That's already locked in as a permanent record, so it can't be changed. Start a new one if you want to update it.";
  }

  if (isGoalSlotLimitError(message)) {
    return "You've already got that slot filled — finish or drop an existing goal before adding another.";
  }

  return "We couldn't save that just now. Your answers so far are safe — check your connection and try again.";
}

export function friendlySignupError(message: string | undefined | null): {
  message: string;
  isExistingAccount: boolean;
} {
  const lower = (message ?? "").toLowerCase();

  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already exists")) {
    return {
      message:
        "Looks like you already have an account with that email. Sign in there instead — what you just shared is saved either way, so nothing's lost.",
      isExistingAccount: true,
    };
  }

  if (lower.includes("password")) {
    return {
      message: "Password needs to be at least 8 characters.",
      isExistingAccount: false,
    };
  }

  if (lower.includes("email") && (lower.includes("invalid") || lower.includes("valid"))) {
    return {
      message: "That doesn't look like a valid email address — check it and try again.",
      isExistingAccount: false,
    };
  }

  return {
    message: "We couldn't create your account just now. Your results are saved either way — try again in a moment.",
    isExistingAccount: false,
  };
}

export function friendlySignInError(message: string | undefined | null): string {
  const lower = (message ?? "").toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "That email and password don't match. Check them and try again.";
  }

  return "We couldn't sign you in just now. Check your details and try again.";
}
