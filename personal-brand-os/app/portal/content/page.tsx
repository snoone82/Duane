import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { contentStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Content" };

export default async function PortalContentPage() {
  const client = await getPortalClient();
  if (!client) return null;

  const supabase = await createClient();
  const { data: ideas } = await supabase
    .from("content_ideas")
    .select("*")
    .eq("client_id", client.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const upcoming = (ideas ?? []).filter((i) => i.status !== "published" && i.status !== "measured");
  const published = (ideas ?? []).filter((i) => i.status === "published" || i.status === "measured").slice(0, 15);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">Your content pipeline — what&rsquo;s planned, in production and recently published.</p>

      {(ideas ?? []).length === 0 ? (
        <EmptyState title="No content yet" description="Planned and published content will appear here as the pipeline fills up." />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">In the pipeline</h2>
              <div className="space-y-2">
                {upcoming.map((idea) => {
                  const meta = contentStatusMeta(idea.status);
                  return (
                    <div key={idea.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{idea.title}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {[idea.platform, idea.format, idea.due_date ? `due ${formatDate(idea.due_date)}` : null]
                            .filter(Boolean)
                            .join(" · ") || "Details to come"}
                        </p>
                      </div>
                      <StatusPill label={meta.label} color={meta.color} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {published.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">Published</h2>
              <div className="space-y-2">
                {published.map((idea) => (
                  <div key={idea.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="min-w-0">
                      {idea.published_url ? (
                        <a
                          href={idea.published_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                        >
                          {idea.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-ink">{idea.title}</p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-faint">{[idea.platform, idea.format].filter(Boolean).join(" · ")}</p>
                    </div>
                    <StatusPill label={contentStatusMeta(idea.status).label} color={contentStatusMeta(idea.status).color} />
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
