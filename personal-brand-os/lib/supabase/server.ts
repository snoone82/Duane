import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Reads/writes the auth session via cookies. Server
 * Components can't write cookies, so `setAll` is wrapped in a try/catch —
 * the middleware is what actually refreshes the session on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * The exact type `await createClient()` produces. lib/data/*.ts functions
 * take this as their `supabase` parameter type instead of hand-rolling
 * `SupabaseClient<Database>` — @supabase/ssr's `createServerClient<Database>`
 * resolves its schema/options generics in a way that doesn't line up with a
 * manually reconstructed `SupabaseClient<Database>` alias (confirmed via a
 * real `tsc --noEmit` run), so deriving the type from the real factory
 * function is what actually type-checks.
 */
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
