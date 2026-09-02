import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReadOnlyField } from "@/components/portal/ReadOnlyField";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Meetings" };

export default async function PortalMeetingsPage() {
  const client = await getPortalClient();
  if (!client) return null;

  const supabase = await createClient();
  // portal_meeting_summaries is the safe-column view — clients see the
  // summary, wins and dates, never the internal strategic notes.
  const { data: meetings } = await supabase
    .from("portal_meeting_summaries")
    .select("*")
    .eq("client_id", client.id)
    .order("meeting_date", { ascending: false });

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-ink-soft">A record of your sessions with the team — what was covered and what&rsquo;s next.</p>

      {!meetings || meetings.length === 0 ? (
        <EmptyState title="No meetings logged yet" description="After each session, a summary will appear here." />
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">{formatDate(meeting.meeting_date)}</p>
                {meeting.meeting_type && <p className="text-xs text-ink-faint">{meeting.meeting_type}</p>}
              </div>
              <div className="space-y-2">
                <ReadOnlyField label="Summary" value={meeting.summary} />
                <ReadOnlyField label="Wins" value={meeting.wins} />
              </div>
              {meeting.next_meeting_date && (
                <p className="mt-3 text-xs text-ink-faint">Next meeting: {formatDate(meeting.next_meeting_date)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
