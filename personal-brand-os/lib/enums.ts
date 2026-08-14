/**
 * Friendly aliases for the generated schema's nested Enums — the real
 * `supabase gen types` output (lib/database.types.ts) only exposes these as
 * `Database["public"]["Enums"]["action_status"]`, not as top-level named
 * types. Keeping the short names the rest of the app already uses here
 * rather than hand-editing every call site, and rather than re-adding them
 * to database.types.ts itself (that file should stay a clean, regeneratable
 * copy of what the CLI actually outputs).
 */
import type { Database } from "@/lib/database.types";

export type ProfileRole = Database["public"]["Enums"]["profile_role"];
export type ClientStatus = Database["public"]["Enums"]["client_status"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type AuthorityStatus = Database["public"]["Enums"]["authority_status"];
export type ActionStatus = Database["public"]["Enums"]["action_status"];
export type FileCategory = Database["public"]["Enums"]["file_category"];
export type ContentPriority = Database["public"]["Enums"]["content_priority"];
