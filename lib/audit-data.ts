import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Audit, AuditResponse, LifeArea } from "@/lib/database.types";

/**
 * Read-only data access for Server Components. Every query below relies on
 * RLS to scope results to the signed-in user — if something comes back
 * empty, the first thing to check is the session (see lib/audit.ts note in
 * the brief), not the query itself.
 */

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getLifeAreas(): Promise<LifeArea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("life_areas")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getInProgressAudit(userId: string): Promise<Audit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLatestCompletedAudit(userId: string): Promise<Audit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAuditResponses(auditId: string): Promise<AuditResponse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_responses")
    .select("*")
    .eq("audit_id", auditId);

  if (error) throw error;
  return data ?? [];
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
