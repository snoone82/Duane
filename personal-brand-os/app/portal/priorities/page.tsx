import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { actionStatusMeta } from "@/lib/status";
import { formatRelativeToToday, isOverdue } from "@/lib/format";

export const metadata = { title: "Priorities" };

export default async function PortalPrioritiesPage() {
  const client = await getPortalClient();
  if (!client) return null;

  const supabase = await createClient();
  const { data: actions } = await supabase
    .from("actions")
    .select("*")
    .eq("client_id", client.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const open = (actions ?? []).filter((a) => a.status !== "completed");
  const done = (actions ?? []).filter((a) => a.status === "completed").slice(0, 10);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">What&rsquo;s being worked on for your brand right now.</p>

      {open.length === 0 && done.length === 0 ? (
        <EmptyState title="No actions yet" description="Priorities agreed with the team will show up here." />
      ) : (
        <>
          <div className="space-y-2">
            {open.map((action) => {
              const meta = actionStatusMeta(action.status);
              return (
                <div key={action.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{action.title}</p>
                    {action.description.trim() && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{action.description}</p>
                    )}
                    {action.due_date && (
                      <p className={`mt-1 text-xs ${isOverdue(action.due_date) ? "text-danger" : "text-ink-faint"}`}>
                        Due {formatRelativeToToday(action.due_date)}
                      </p>
                    )}
                  </div>
                  <StatusPill label={meta.label} color={meta.color} />
                </div>
              );
            })}
            {open.length === 0 && <p className="text-sm text-ink-faint">Nothing open right now — everything&rsquo;s done.</p>}
          </div>

          {done.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">Recently completed</h2>
              <div className="space-y-2">
                {done.map((action) => (
                  <div key={action.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
                    <p className="text-sm text-ink-soft line-through decoration-ink-faint">{action.title}</p>
                    <StatusPill label="Completed" color="green" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
