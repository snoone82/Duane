/**
 * Validates the public Supabase environment variables once, at import time,
 * instead of letting bare `process.env.X!` assertions defer the failure to
 * whatever request happens to touch them first. Any module that needs these
 * values should import `env` from here rather than reading `process.env`
 * directly — see lib/supabase/client.ts, lib/supabase/server.ts and
 * lib/supabase/middleware.ts.
 *
 * Throws a specific, actionable error message (which file, which variable,
 * what it should look like) instead of the vague "Invalid URL" or
 * "supabaseUrl is required" errors that Supabase's own client throws when
 * handed `undefined`.
 */

/**
 * `process.env.NEXT_PUBLIC_X` must appear as a literal, static property
 * access — not `process.env[name]` through a variable — because Next.js
 * inlines NEXT_PUBLIC_* values into the Edge Runtime (middleware) and
 * client bundles via static analysis at build time, not a live `process.env`
 * at runtime. A dynamic/computed lookup is invisible to that scanner, so the
 * value silently never gets inlined there (Node-runtime contexts still work,
 * since they have a real process.env — only middleware/client breaks, which
 * is exactly the confusing failure mode this two-liner exists to avoid).
 */
function readRequired(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  value: string | undefined
): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local — see the ` +
        `"Environment" section in README.md. The app can't start without it.`
    );
  }
  return value;
}

function assertPlausibleUrl(name: string, value: string): string {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    throw new Error(
      `Environment variable ${name} is set but isn't a valid URL ("${value}"). ` +
        `Expected something like https://<project-ref>.supabase.co — check .env.local.`
    );
  }
  return value;
}

function assertPlausibleAnonKey(name: string, value: string): string {
  // Not a cryptographic check — just enough to catch "pasted the wrong
  // value" (empty string, a project ref, a service-role key placeholder,
  // etc.) early rather than as a confusing Supabase auth failure later.
  // Supabase anon keys are JWTs: three dot-separated, non-empty segments.
  const segments = value.split(".");
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    throw new Error(
      `Environment variable ${name} doesn't look like a Supabase anon key ` +
        `(expected a JWT with three dot-separated segments). Check .env.local.`
    );
  }
  return value;
}

const supabaseUrl = assertPlausibleUrl(
  "NEXT_PUBLIC_SUPABASE_URL",
  readRequired("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
);

const supabaseAnonKey = assertPlausibleAnonKey(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
} as const;
