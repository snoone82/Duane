import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PortalContentApproval } from "@/components/portal/PortalContentApproval";
import { MediaPreview } from "@/components/clients/OutputMediaSlot";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { contentStatusMeta, outputStatusMeta, type OutputStatus } from "@/lib/status";
import { formatDate, formatDateTime, socialAccountLabel } from "@/lib/format";
import { thumbUrl } from "@/lib/media";

export const metadata = { title: "Content" };

export default async function PortalContentPage() {
  const context = await getPortalContext();
  if (!context) return null;
  const client = context.client;
  const canApprove = context.can("approve_content");

  const supabase = await createClient();
  const [{ data: ideas }, { data: outputs }] = await Promise.all([
    supabase
      .from("content_ideas")
      .select("*")
      .eq("client_id", client.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_outputs")
      .select("*, social:social_strategies(account_name)")
      .eq("client_id", client.id)
      .order("sort_order", { ascending: true }),
  ]);

  const outputsByContent = new Map<string, NonNullable<typeof outputs>>();
  for (const output of outputs ?? []) {
    const list = outputsByContent.get(output.content_id) ?? [];
    list.push(output);
    outputsByContent.set(output.content_id, list);
  }

  const all = ideas ?? [];
  const awaitingApproval = all.filter((i) => i.status === "ready_for_approval");
  const published = all.filter((i) => i.status === "published").slice(0, 15);
  const upcoming = all.filter((i) => i.status !== "published" && i.status !== "ready_for_approval");

  const outputLine = (contentId: string) =>
    (outputsByContent.get(contentId) ?? []).map((o) => socialAccountLabel(o.platform, o.social?.account_name)).join(" · ");

  /** The card's primary thumbnail: the first platform version with media. */
  const primaryThumb = (contentId: string) => {
    for (const output of outputsByContent.get(contentId) ?? []) {
      const thumb = thumbUrl(output);
      if (thumb) return thumb;
    }
    return null;
  };

  /** Expandable per-platform versions — Duane's "open the content item and
   * see the individual platform versions", with their assets. */
  const platformVersions = (contentId: string) => {
    const list = outputsByContent.get(contentId) ?? [];
    if (list.length === 0) return null;
    return (
      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-accent underline-offset-2 hover:underline">
          <span className="group-open:hidden">Show platform versions ({list.length}) ▾</span>
          <span className="hidden group-open:inline">Hide platform versions ▴</span>
        </summary>
        <div className="mt-2 space-y-2">
          {list.map((output) => (
            <div key={output.id} className="rounded-md bg-surface-muted/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">
                  {socialAccountLabel(output.platform, output.social?.account_name)}
                  {output.format ? ` · ${output.format}` : ""}
                </p>
                <span className="text-xs text-ink-faint">
                  {output.status === "scheduled" && output.scheduled_at
                    ? `scheduled ${formatDateTime(output.scheduled_at)}`
                    : outputStatusMeta(output.status as OutputStatus).label.toLowerCase()}
                </span>
              </div>
              {output.caption && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{output.caption}</p>}
              {output.cta && <p className="mt-1 text-xs text-ink-faint">CTA: {output.cta}</p>}
              {output.media_url && (
                <div className="mt-2">
                  <MediaPreview url={output.media_url} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">Your content pipeline — what&rsquo;s planned, in production and recently published.</p>

      {all.length === 0 ? (
        <EmptyState title="No content yet" description="Planned and published content will appear here as the pipeline fills up." />
      ) : (
        <>
          {awaitingApproval.length > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
              <h2 className="mb-1 text-sm font-semibold text-ink">Awaiting approval · {awaitingApproval.length}</h2>
              <p className="mb-3 text-xs text-ink-soft">
                {canApprove
                  ? "Read the final copy for each platform below, then approve it for scheduling or send it back with comments."
                  : "These pieces are waiting for approval — approving content isn't enabled for your account."}
              </p>
              <div className="space-y-3">
                {awaitingApproval.map((idea) => (
                  <div key={idea.id} id={`idea-${idea.id}`} className="scroll-mt-4 rounded-lg border border-border bg-surface px-4 py-3">
                    <p className="text-sm font-medium text-ink">{idea.title}</p>
                    {idea.hook && <p className="mt-1 text-xs italic text-ink-soft">&ldquo;{idea.hook}&rdquo;</p>}
                    {(outputsByContent.get(idea.id) ?? []).map((output) => (
                      <div key={output.id} className="mt-2 rounded-md bg-surface-muted/50 p-3">
                        <p className="text-xs font-semibold text-ink">
                          {socialAccountLabel(output.platform, output.social?.account_name)}
                          {output.format ? ` · ${output.format}` : ""}
                        </p>
                        {output.caption ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{output.caption}</p>
                        ) : (
                          <p className="mt-1 text-xs text-ink-faint">Final copy to follow.</p>
                        )}
                        {output.cta && <p className="mt-1 text-xs text-ink-faint">CTA: {output.cta}</p>}
                        {output.media_url && (
                          <div className="mt-2">
                            <MediaPreview url={output.media_url} />
                          </div>
                        )}
                      </div>
                    ))}
                    {canApprove && <PortalContentApproval ideaId={idea.id} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">In the pipeline</h2>
              <div className="space-y-2">
                {upcoming.map((idea) => {
                  const meta = contentStatusMeta(idea.status);
                  const scheduled = (outputsByContent.get(idea.id) ?? []).filter((o) => o.status === "scheduled");
                  const thumb = primaryThumb(idea.id);
                  return (
                    <div key={idea.id} id={`idea-${idea.id}`} className="scroll-mt-4 rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {thumb && <MediaThumb url={thumb} />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{idea.title}</p>
                            <p className="mt-0.5 text-xs text-ink-faint">
                              {[outputLine(idea.id), idea.target_publish_date ? `target ${formatDate(idea.target_publish_date)}` : null]
                                .filter(Boolean)
                                .join(" · ") || "Details to come"}
                            </p>
                          </div>
                        </div>
                        <StatusPill label={meta.label} color={meta.color} />
                      </div>
                      {scheduled.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {scheduled.map((o) => (
                            <li key={o.id} className="text-xs text-ink-soft">
                              {socialAccountLabel(o.platform, o.social?.account_name)} — going out {o.scheduled_at ? formatDateTime(o.scheduled_at) : "soon"}
                            </li>
                          ))}
                        </ul>
                      )}
                      {platformVersions(idea.id)}
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
                {published.map((idea) => {
                  const ideaOutputs = (outputsByContent.get(idea.id) ?? []).filter((o) => o.status === "published");
                  const thumb = primaryThumb(idea.id);
                  return (
                    <div key={idea.id} id={`idea-${idea.id}`} className="scroll-mt-4 rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {thumb && <MediaThumb url={thumb} />}
                          <p className="text-sm font-medium text-ink">{idea.title}</p>
                        </div>
                        <StatusPill label={contentStatusMeta(idea.status).label} color={contentStatusMeta(idea.status).color} />
                      </div>
                      {ideaOutputs.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {ideaOutputs.map((o) => {
                            const oMeta = outputStatusMeta(o.status as OutputStatus);
                            return (
                              <li key={o.id} className="flex items-center gap-2 text-xs text-ink-soft">
                                {o.live_url ? (
                                  <a href={o.live_url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                                    {socialAccountLabel(o.platform, o.social?.account_name)}
                                    {o.format ? ` · ${o.format}` : ""} →
                                  </a>
                                ) : (
                                  <span>
                                    {socialAccountLabel(o.platform, o.social?.account_name)}
                                    {o.format ? ` · ${o.format}` : ""}
                                  </span>
                                )}
                                <span className="text-ink-faint">{oMeta.label.toLowerCase()}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {platformVersions(idea.id)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
