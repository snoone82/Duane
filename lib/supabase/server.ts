import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers
 * and Server Actions. Reads/writes the auth session via cookies so it stays
 * in sync with the browser client automatically.
 *
 * Server Components can't write cookies (Next.js restriction), so the
 * `setAll` call is wrapped in a try/catch — the middleware is what actually
 * refreshes the session on every request, this is just a safe no-op when
 * called from a context that can't set cookies.
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
