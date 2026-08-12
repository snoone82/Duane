import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "./env"; // side effect: loads .env.local into process.env if not already set
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Anon-key Supabase client for direct database assertions in the e2e suite
 * (e2e/database.spec.ts). Deliberately the exact same key — and therefore
 * the exact same RLS posture — the real app uses (lib/supabase/client.ts,
 * lib/supabase/server.ts). There is no service-role key anywhere in this
 * project and these tests must never introduce one: every assertion here
 * authenticates as a real user (anonymous or a created account) and relies
 * on RLS to scope what it can see, the same as the app does.
 */
export function createTestSupabaseClient(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are required to run the " +
        "database-verification specs. Make sure .env.local is populated (see README.md's " +
        '"Environment" and "Running the tests" sections) or export them before running ' +
        "`npm run test:e2e`."
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
