import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Audit, AuditResponse, Checkin, ClearPlan, Goal, LifeArea } from "@/lib/database.types";

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

/** Every completed audit for a user, oldest first — the Dashboard's "Audit 1 → Audit 2 → …" trend (brief §4/§10) reads directly off this; nothing is ever overwritten, so this is the full history. */
export async function getCompletedAudits(userId: string): Promise<Audit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** The active goal of a given role ("primary" from CLEAR, or "supporting") — at most one active primary + two active supporting per user, enforced in the database. */
export async function getActiveGoal(userId: string, role: "primary" | "supporting"): Promise<Goal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("role", role)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActiveSupportingGoals(userId: string): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("role", "supporting")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getCheckins(goalId: string): Promise<Checkin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("goal_id", goalId)
    .order("checkin_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** The most recent CLEAR plan for a user — in progress or completed, whichever was touched last. */
export async function getLatestClearPlan(userId: string): Promise<ClearPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clear_plans")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getClearPlanById(id: string, userId: string): Promise<ClearPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clear_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getGoalById(id: string, userId: string): Promise<Goal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Streak/completion-rate/momentum computed here, not stored — see the
 * comment on checkins in supabase/migrations/0004_phase_two_clear_goals_tracker.sql
 * for why. "Streak" counts consecutive days with action_completed = true,
 * walking backwards from today; a day with no check-in at all breaks it,
 * same as a day logged with action_completed = false.
 */
export function summarizeCheckins(checkins: Checkin[], goal: Goal) {
  const byDate = new Map(checkins.map((c) => [c.checkin_date, c]));
  const actionsDone = checkins.filter((c) => c.action_completed).length;

  const start = new Date(goal.start_date + "T00:00:00Z");
  const today = new Date();
  const totalDaysSoFar =
    Math.min(30, Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1) || 0;
  const completionRate =
    totalDaysSoFar > 0 ? Math.round((actionsDone / Math.max(totalDaysSoFar, 1)) * 100) : 0;

  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 30; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = byDate.get(key);
    if (!entry?.action_completed) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { actionsDone, completionRate, streak, daysLogged: checkins.length };
}
