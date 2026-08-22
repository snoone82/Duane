import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { TagColor } from "@/lib/status";
import { getClientsMap } from "@/lib/data/shared";
import { socialAccountLabel } from "@/lib/format";

type Client = SupabaseServerClient;

export type CalendarItemType =
  | "meeting"
  | "action"
  | "content"
  | "scheduled"
  | "published"
  | "authority"
  | "milestone";

export interface CalendarItem {
  date: string; // YYYY-MM-DD
  /** Sort key within a day; scheduled/published posts carry a real time. */
  time: string | null; // HH:MM
  type: CalendarItemType;
  label: string;
  clientId: string;
  clientName: string;
  tab: string;
  /** Scheduled/due in the past but not done — Duane's "overdue or missed". */
  overdue?: boolean;
  /** Team-member owner, where the underlying record has one (actions). */
  ownerUserId?: string | null;
}

export const CALENDAR_TYPE_META: Record<CalendarItemType, { label: string; color: TagColor }> = {
  meeting: { label: "Meetings", color: "teal" },
  action: { label: "Actions due", color: "amber" },
  content: { label: "Content due", color: "purple" },
  scheduled: { label: "Content scheduled", color: "orange" },
  published: { label: "Content published", color: "green" },
  authority: { label: "Authority", color: "pink" },
  milestone: { label: "Milestones", color: "blue" },
};

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

function timePart(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * Everything date-bearing across every client the signed-in user can see
 * (RLS-scoped like the rest of the app), for one date window. A view over
 * existing data — the calendar has no tables of its own.
 */
export async function getCalendarItems(
  supabase: Client,
  from: string,
  to: string,
  clientFilter?: string
): Promise<CalendarItem[]> {
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;

  const maybeFilter = <T extends { eq: (col: string, v: string) => T }>(q: T): T =>
    clientFilter ? q.eq("client_id", clientFilter) : q;

  const [
    { data: consultations },
    { data: nextMeetings },
    { data: actions },
    { data: content },
    { data: scheduledOutputs },
    { data: publishedOutputs },
    { data: authority },
    { data: milestones },
    clients,
  ] = await Promise.all([
    maybeFilter(supabase.from("consultations").select("id,client_id,meeting_date").gte("meeting_date", from).lte("meeting_date", to)),
    maybeFilter(
      supabase
        .from("consultations")
        .select("id,client_id,next_meeting_date")
        .not("next_meeting_date", "is", null)
        .gte("next_meeting_date", from)
        .lte("next_meeting_date", to)
    ),
    maybeFilter(
      supabase
        .from("actions")
        .select("id,client_id,title,due_date,status,owner_user_id")
        .neq("status", "completed")
        .not("due_date", "is", null)
        .gte("due_date", from)
        .lte("due_date", to)
    ),
    maybeFilter(
      supabase
        .from("content_ideas")
        .select("id,client_id,title,due_date,status")
        .not("due_date", "is", null)
        .not("status", "in", "(published,scheduled)")
        .gte("due_date", from)
        .lte("due_date", to)
    ),
    maybeFilter(
      supabase
        .from("content_outputs")
        .select("id,client_id,platform,status,scheduled_at,content:content_ideas(title),social:social_strategies(account_name)")
        .eq("status", "scheduled")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", fromTs)
        .lte("scheduled_at", toTs)
    ),
    maybeFilter(
      supabase
        .from("content_outputs")
        .select("id,client_id,platform,status,published_at,content:content_ideas(title),social:social_strategies(account_name)")
        .eq("status", "published")
        .not("published_at", "is", null)
        .gte("published_at", fromTs)
        .lte("published_at", toTs)
    ),
    maybeFilter(
      supabase
        .from("authority_opportunities")
        .select("id,client_id,type,host,opportunity_date,status")
        .not("opportunity_date", "is", null)
        .neq("status", "declined")
        .gte("opportunity_date", from)
        .lte("opportunity_date", to)
    ),
    maybeFilter(supabase.from("milestones").select("id,client_id,title,milestone_date").gte("milestone_date", from).lte("milestone_date", to)),
    getClientsMap(supabase),
  ]);

  const name = (id: string) => clients.get(id) ?? "Unknown client";
  const now = new Date().toISOString();
  const items: CalendarItem[] = [];

  for (const c of consultations ?? []) {
    items.push({ date: c.meeting_date, time: null, type: "meeting", label: `Consultation · ${name(c.client_id)}`, clientId: c.client_id, clientName: name(c.client_id), tab: "consultations" });
  }
  for (const c of nextMeetings ?? []) {
    items.push({ date: c.next_meeting_date as string, time: null, type: "meeting", label: `Meeting · ${name(c.client_id)}`, clientId: c.client_id, clientName: name(c.client_id), tab: "consultations" });
  }
  const today = now.slice(0, 10);
  for (const a of actions ?? []) {
    items.push({
      date: a.due_date as string,
      time: null,
      type: "action",
      label: a.title,
      clientId: a.client_id,
      clientName: name(a.client_id),
      tab: "actions",
      overdue: (a.due_date as string) < today,
      ownerUserId: a.owner_user_id,
    });
  }
  for (const i of content ?? []) {
    items.push({ date: i.due_date as string, time: null, type: "content", label: i.title, clientId: i.client_id, clientName: name(i.client_id), tab: "content" });
  }
  for (const o of scheduledOutputs ?? []) {
    const when = o.scheduled_at as string;
    items.push({
      date: datePart(when),
      time: timePart(when),
      type: "scheduled",
      label: `${o.content?.title ?? "Content"} · ${socialAccountLabel(o.platform, o.social?.account_name)}`,
      clientId: o.client_id,
      clientName: name(o.client_id),
      tab: "content",
      overdue: when < now,
    });
  }
  for (const o of publishedOutputs ?? []) {
    const when = o.published_at as string;
    items.push({
      date: datePart(when),
      time: timePart(when),
      type: "published",
      label: `${o.content?.title ?? "Content"} · ${socialAccountLabel(o.platform, o.social?.account_name)}`,
      clientId: o.client_id,
      clientName: name(o.client_id),
      tab: "content",
    });
  }
  for (const o of authority ?? []) {
    items.push({ date: o.opportunity_date as string, time: null, type: "authority", label: `${o.type}${o.host ? ` · ${o.host}` : ""}`, clientId: o.client_id, clientName: name(o.client_id), tab: "authority" });
  }
  for (const m of milestones ?? []) {
    items.push({ date: m.milestone_date, time: null, type: "milestone", label: m.title, clientId: m.client_id, clientName: name(m.client_id), tab: "timeline" });
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return items;
}
