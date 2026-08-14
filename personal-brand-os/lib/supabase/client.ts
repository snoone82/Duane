import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Browser-side Supabase client. Uses cookie-based sessions (via @supabase/ssr)
 * so the same session is readable by server components and the middleware.
 * Create a fresh instance per call site.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
