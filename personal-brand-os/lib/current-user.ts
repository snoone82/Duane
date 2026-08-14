import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * The signed-in team member's profile row, or null if there isn't one —
 * either nobody's signed in, or they're signed in but Duane hasn't created
 * their profile row (shouldn't happen since the handle_new_user trigger
 * creates it automatically, but a stale/deleted profile is exactly the "no
 * access" case the brief calls out).
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile;
}
