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

function readRequired(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
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
  readRequired("NEXT_PUBLIC_SUPABASE_URL")
);

const supabaseAnonKey = assertPlausibleAnonKey(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
} as const;
