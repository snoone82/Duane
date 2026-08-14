import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

export async function getOverviewSummary(supabase: Client, clientId: string) {
  const [{ data: openActions }, { data: consultations }] = await Promise.all([
    supabase
      .from("actions")
      .select("id,title,due_date,status")
      .eq("client_id", clientId)
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("consultations")
      .select("meeting_date,next_meeting_date")
      .eq("client_id", clientId)
      .order("meeting_date", { ascending: false })
      .limit(1),
  ]);

  const latest = consultations?.[0];
  const nextMeeting = latest?.next_meeting_date && latest.next_meeting_date >= new Date().toISOString().slice(0, 10)
    ? latest.next_meeting_date
    : null;

  return {
    openActions: openActions ?? [],
    lastConsultation: latest?.meeting_date ?? null,
    nextMeeting,
  };
}
