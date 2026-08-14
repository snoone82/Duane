import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { TagColor } from "@/lib/status";
import { getClientsMap } from "@/lib/data/shared";

type Client = SupabaseServerClient;

export type CalendarItemType = "meeting" | "action" | "content" | "authority" | "milestone";

export interface CalendarItem {
  date: string; // YYYY-MM-DD
  type: CalendarItemType;
  label: string;
  clientId: string;
  clientName: string;
  tab: string;
}

export const CALENDAR_TYPE_META: Record<CalendarItemType, { label: string; color: TagColor }> = {
  meeting: { label: "Meetings", color: "teal" },
  action: { label: "Actions due", color: "amber" },
  content: { label: "Content due", color: "purple" },
  authority: { label: "Authority", color: "pink" },
  milestone: { label: "Milestones", color: "green" },
};

/**
 * Everything date-bearing across every client the signed-in user can see
 * (RLS-scoped like the rest of the app), for one month window. A view over
 * existing data — the calendar has no tables of its own.
 */
export async function getCalendarItems(supabase: Client, from: string, to: string): Promise<CalendarItem[]> {
  const [
    { data: consultations },
    { data: nextMeetings },
    { data: actions },
    { data: content },
    { data: authority },
    { data: milestones },
    clients,
  ] = await Promise.all([
    supabase.from("consultations").select("id,client_id,meeting_date").gte("meeting_date", from).lte("meeting_date", to),
    supabase
      .from("consultations")
      .select("id,client_id,next_meeting_date")
      .not("next_meeting_date", "is", null)
      .gte("next_meeting_date", from)
      .lte("next_meeting_date", to),
    supabase
      .from("actions")
      .select("id,client_id,title,due_date,status")
      .neq("status", "completed")
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to),
    supabase
      .from("content_ideas")
      .select("id,client_id,title,due_date,status")
      .not("due_date", "is", null)
      .not("status", "in", "(published,measured)")
      .gte("due_date", from)
      .lte("due_date", to),
    supabase
      .from("authority_opportunities")
      .select("id,client_id,type,host,opportunity_date,status")
      .not("opportunity_date", "is", null)
      .neq("status", "declined")
      .gte("opportunity_date", from)
      .lte("opportunity_date", to),
    supabase.from("milestones").select("id,client_id,title,milestone_date").gte("milestone_date", from).lte("milestone_date", to),
    getClientsMap(supabase),
  ]);

  const name = (id: string) => clients.get(id) ?? "Unknown client";
  const items: CalendarItem[] = [];

  for (const c of consultations ?? []) {
    items.push({ date: c.meeting_date, type: "meeting", label: `Consultation · ${name(c.client_id)}`, clientId: c.client_id, clientName: name(c.client_id), tab: "consultations" });
  }
  for (const c of nextMeetings ?? []) {
    items.push({ date: c.next_meeting_date as string, type: "meeting", label: `Meeting · ${name(c.client_id)}`, clientId: c.client_id, clientName: name(c.client_id), tab: "consultations" });
  }
  for (const a of actions ?? []) {
    items.push({ date: a.due_date as string, type: "action", label: a.title, clientId: a.client_id, clientName: name(a.client_id), tab: "actions" });
  }
  for (const i of content ?? []) {
    items.push({ date: i.due_date as string, type: "content", label: i.title, clientId: i.client_id, clientName: name(i.client_id), tab: "content" });
  }
  for (const o of authority ?? []) {
    items.push({ date: o.opportunity_date as string, type: "authority", label: `${o.type}${o.host ? ` · ${o.host}` : ""}`, clientId: o.client_id, clientName: name(o.client_id), tab: "authority" });
  }
  for (const m of milestones ?? []) {
    items.push({ date: m.milestone_date, type: "milestone", label: m.title, clientId: m.client_id, clientName: name(m.client_id), tab: "timeline" });
  }

  return items;
}
