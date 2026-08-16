import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getClientsMap, getProfilesMap, ownerLabel } from "@/lib/data/shared";

type Client = SupabaseServerClient;

const todayISO = () => new Date().toISOString().slice(0, 10);

export interface DashboardAction {
  id: string;
  title: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  ownerLabel: string;
  isOverdue: boolean;
}

/** Overdue first, then soonest-due — both fall out of a plain ascending sort. */
export async function getActionsDue(supabase: Client): Promise<DashboardAction[]> {
  const today = todayISO();
  const [{ data: actions }, clients, profiles] = await Promise.all([
    supabase
      .from("actions")
      .select("id,title,due_date,client_id,owner_user_id,owner_name")
      .neq("status", "completed")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true }),
    getClientsMap(supabase),
    getProfilesMap(supabase),
  ]);

  return (actions ?? []).map((action) => ({
    id: action.id,
    title: action.title,
    dueDate: action.due_date as string,
    clientId: action.client_id,
    clientName: clients.get(action.client_id) ?? "Unknown client",
    ownerLabel: ownerLabel(action, profiles),
    isOverdue: (action.due_date as string) < today,
  }));
}

export interface DashboardMeeting {
  id: string;
  clientId: string;
  clientName: string;
  nextMeetingDate: string;
}

export async function getMeetingsThisWeek(supabase: Client): Promise<DashboardMeeting[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  const [{ data: consultations }, clients] = await Promise.all([
    supabase
      .from("consultations")
      .select("id,client_id,next_meeting_date")
      .not("next_meeting_date", "is", null)
      .gte("next_meeting_date", today.toISOString().slice(0, 10))
      .lte("next_meeting_date", in7Days.toISOString().slice(0, 10))
      .order("next_meeting_date", { ascending: true }),
    getClientsMap(supabase),
  ]);

  return (consultations ?? []).map((c) => ({
    id: c.id,
    clientId: c.client_id,
    clientName: clients.get(c.client_id) ?? "Unknown client",
    nextMeetingDate: c.next_meeting_date as string,
  }));
}

export interface ContentAwaitingApprovalGroup {
  clientId: string;
  clientName: string;
  ideas: { id: string; title: string }[];
}

export async function getContentAwaitingApproval(supabase: Client): Promise<ContentAwaitingApprovalGroup[]> {
  const [{ data: ideas }, clients] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("id,title,client_id")
      .eq("status", "idea")
      .order("created_at", { ascending: true }),
    getClientsMap(supabase),
  ]);

  const groups = new Map<string, ContentAwaitingApprovalGroup>();
  for (const idea of ideas ?? []) {
    const existing = groups.get(idea.client_id);
    const entry = { id: idea.id, title: idea.title };
    if (existing) {
      existing.ideas.push(entry);
    } else {
      groups.set(idea.client_id, {
        clientId: idea.client_id,
        clientName: clients.get(idea.client_id) ?? "Unknown client",
        ideas: [entry],
      });
    }
  }
  return Array.from(groups.values());
}

export interface ContentPipelineSummary {
  awaitingProduction: number;
  awaitingApproval: number;
  changesRequested: number;
  readyToSchedule: number;
  scheduledNext7Days: number;
  publishedLast7Days: number;
  overdueScheduled: number;
}

/** Duane's §8 dashboard visibility — is there enough approved and scheduled
 * content, and is anything stuck or missed? Counts across every client the
 * signed-in user can see. */
export async function getContentPipelineSummary(supabase: Client): Promise<ContentPipelineSummary> {
  const now = new Date();
  const nowIso = now.toISOString();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: ideas }, { data: scheduled }, { data: published }] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("status")
      .in("status", ["approved_production", "in_production", "ready_for_approval", "changes_requested", "ready_to_schedule"]),
    supabase.from("content_outputs").select("scheduled_at").eq("status", "scheduled").not("scheduled_at", "is", null),
    supabase.from("content_outputs").select("published_at").eq("status", "published").gte("published_at", ago7),
  ]);

  const count = (status: string) => (ideas ?? []).filter((i) => i.status === status).length;
  const scheduledList = (scheduled ?? []).map((o) => o.scheduled_at as string);

  return {
    awaitingProduction: count("approved_production") + count("in_production"),
    awaitingApproval: count("ready_for_approval"),
    changesRequested: count("changes_requested"),
    readyToSchedule: count("ready_to_schedule"),
    scheduledNext7Days: scheduledList.filter((t) => t >= nowIso && t <= in7).length,
    publishedLast7Days: (published ?? []).length,
    overdueScheduled: scheduledList.filter((t) => t < nowIso).length,
  };
}

export interface AttentionFlag {
  clientId: string;
  clientName: string;
  reason: string;
}

/**
 * Active clients only — a paused/prospect/offboarded client going quiet
 * isn't the kind of thing that needs a morning nudge. Not specified in the
 * brief; flagged as a judgment call in the README.
 */
export async function getAttentionFlags(supabase: Client): Promise<AttentionFlag[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [{ data: activeClients }, { data: publishedContent }, { data: consultations }] = await Promise.all([
    supabase.from("clients").select("id,name").eq("status", "active"),
    supabase.from("content_ideas").select("client_id,updated_at").eq("status", "published"),
    supabase.from("consultations").select("client_id,meeting_date"),
  ]);

  const lastPublished = new Map<string, string>();
  for (const row of publishedContent ?? []) {
    const current = lastPublished.get(row.client_id);
    if (!current || row.updated_at > current) lastPublished.set(row.client_id, row.updated_at);
  }

  const lastConsultation = new Map<string, string>();
  for (const row of consultations ?? []) {
    const current = lastConsultation.get(row.client_id);
    if (!current || row.meeting_date > current) lastConsultation.set(row.client_id, row.meeting_date);
  }

  const flags: AttentionFlag[] = [];
  for (const client of activeClients ?? []) {
    const publishedAt = lastPublished.get(client.id);
    const consultedAt = lastConsultation.get(client.id);
    const reasons: string[] = [];

    if (!publishedAt || publishedAt < fourteenDaysAgo.toISOString()) {
      reasons.push("no content published in 14+ days");
    }
    if (!consultedAt || consultedAt < thirtyDaysAgo.toISOString().slice(0, 10)) {
      reasons.push("no consultation in 30+ days");
    }
    if (reasons.length > 0) {
      flags.push({ clientId: client.id, clientName: client.name, reason: reasons.join(" · ") });
    }
  }
  return flags;
}

export interface RosterOverview {
  activeCount: number;
  totalCount: number;
  monthlyRetainerTotal: number;
  clientsWithRetainer: number;
}

/** §21 Dashboard's "Active Clients" and "Revenue / Retainer Overview" —
 * this brief explicitly asks for both, unlike the brief this app was
 * originally built against (which explicitly said not to). Following this
 * one since it's the one currently being aligned to. */
export async function getRosterOverview(supabase: Client): Promise<RosterOverview> {
  const { data: clients } = await supabase.from("clients").select("status,retainer_amount");
  const rows = clients ?? [];
  const active = rows.filter((c) => c.status === "active");
  const withRetainer = active.filter((c) => c.retainer_amount !== null);
  return {
    activeCount: active.length,
    totalCount: rows.length,
    monthlyRetainerTotal: withRetainer.reduce((sum, c) => sum + (c.retainer_amount ?? 0), 0),
    clientsWithRetainer: withRetainer.length,
  };
}

export interface ClientProgressRow {
  clientId: string;
  clientName: string;
  averageScore: number;
  scoredCategories: number;
}

/** §21 "Client Progress" — each active client's most recent scorecard
 * average (their latest entry per category, averaged), so movement is
 * visible at a glance without opening every profile. */
export async function getClientProgress(supabase: Client): Promise<ClientProgressRow[]> {
  const [{ data: activeClients }, { data: entries }] = await Promise.all([
    supabase.from("clients").select("id,name").eq("status", "active"),
    supabase.from("scorecard_entries").select("client_id,category,score,scored_at").order("scored_at", { ascending: false }),
  ]);

  const latestByClientCategory = new Map<string, number>();
  for (const entry of entries ?? []) {
    const key = `${entry.client_id}:${entry.category}`;
    if (!latestByClientCategory.has(key)) latestByClientCategory.set(key, entry.score);
  }

  const scoresByClient = new Map<string, number[]>();
  for (const [key, score] of latestByClientCategory) {
    const clientId = key.split(":")[0]!;
    const list = scoresByClient.get(clientId) ?? [];
    list.push(score);
    scoresByClient.set(clientId, list);
  }

  return (activeClients ?? [])
    .map((client) => {
      const scores = scoresByClient.get(client.id) ?? [];
      return {
        clientId: client.id,
        clientName: client.name,
        averageScore: scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
        scoredCategories: scores.length,
      };
    })
    .filter((row) => row.scoredCategories > 0)
    .sort((a, b) => b.averageScore - a.averageScore);
}

export interface RecentActivityItem {
  id: string;
  tableName: string;
  action: string;
  clientId: string | null;
  clientName: string;
  changedByName: string;
  changedAt: string;
}

/** §21 "Recent Client Activity" — sourced from the audit_log (§24 Security),
 * which doubles as this feed. Admin-only, same as the log itself. */
export async function getRecentActivity(supabase: Client, limit = 15): Promise<RecentActivityItem[]> {
  const { data: events } = await supabase
    .from("audit_log")
    .select("id,table_name,action,client_id,changed_by,changed_at")
    .order("changed_at", { ascending: false })
    .limit(limit);

  const rows = events ?? [];
  const [clients, profiles] = await Promise.all([getClientsMap(supabase), getProfilesMap(supabase)]);

  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    action: row.action,
    clientId: row.client_id,
    clientName: row.client_id ? (clients.get(row.client_id) ?? "Unknown client") : "—",
    changedByName: row.changed_by ? (profiles.get(row.changed_by) ?? "Someone") : "System",
    changedAt: row.changed_at,
  }));
}

export interface OpenOpportunity {
  id: string;
  type: string;
  host: string | null;
  status: string;
  clientId: string;
  clientName: string;
}

/** §21 "Opportunities" — authority pipeline items still in play (not yet
 * published or declined), across every client the signed-in user can see. */
export async function getOpenOpportunities(supabase: Client): Promise<OpenOpportunity[]> {
  const [{ data: opportunities }, clients] = await Promise.all([
    supabase
      .from("authority_opportunities")
      .select("id,type,host,status,client_id")
      .not("status", "in", "(published,declined)")
      .order("created_at", { ascending: false }),
    getClientsMap(supabase),
  ]);

  return (opportunities ?? []).map((o) => ({
    id: o.id,
    type: o.type,
    host: o.host,
    status: o.status,
    clientId: o.client_id,
    clientName: clients.get(o.client_id) ?? "Unknown client",
  }));
}
