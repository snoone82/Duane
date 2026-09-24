import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaPreview } from "@/components/clients/OutputMediaSlot";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { ApprovalCard } from "@/components/portal/ApprovalCard";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { AddIdeaButton, EditableIdea } from "@/components/portal/ClientIdeaComposer";
import { contentStatusMeta, outputStatusMeta, type OutputStatus } from "@/lib/status";
import { formatDate, formatDateTime, socialAccountLabel } from "@/lib/format";
import { assetPreview, coverUrl, mediaPreview } from "@/lib/media";

export const metadata = { title: "Content" };

export default async function PortalContentPage() {
  const context = await getPortalContext();
  if (!context) return null;
  const client = context.client;
  const canApprove = context.can("approve_content");

  const supabase = await createClient();
  const [{ data: ideas }, { data: outputs }, { data: pillars }, { data: audienceRows }] = await Promise.all([
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
    // The client picks from their own approved strategy, never free text.
    supabase.from("brand_pillars").select("id,name").eq("client_id", client.id).order("sort_order"),
    supabase.from("audiences").select("id,name").eq("client_id", client.id).order("sort_order"),
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
  // The client's own submissions, still at idea stage — editable by them.
  const myDrafts = all.filter((i) => i.status === "idea" && i.created_by === context.userId);
  const myDraftIds = new Set(myDrafts.map((i) => i.id));
  const upcoming = all.filter(
    (i) => i.status !== "published" && i.status !== "ready_for_approval" && !myDraftIds.has(i.id)
  );

  const outputLine = (contentId: string) =>
    (outputsByContent.get(contentId) ?? []).map((o) => socialAccountLabel(o.platform, o.social?.account_name)).join(" · ");

  /** The card's primary thumbnail: the first platform version with media,
   * inherited master media included. */
  const primaryThumb = (idea: NonNullable<typeof ideas>[number]) => {
    for (const output of outputsByContent.get(idea.id) ?? []) {
      const thumb = mediaPreview(output, idea);
      if (thumb) return thumb;
    }
    return mediaPreview(idea);
  };

  /** The asset the client actually reviews — a video stays a video so it can
   * be played in the card, rather than collapsing to its cover still. */
  const primaryAsset = (idea: NonNullable<typeof ideas>[number]) => {
    for (const output of outputsByContent.get(idea.id) ?? []) {
      const asset = assetPreview(output, idea);
      if (asset) return asset;
    }
    return assetPreview(idea);
  };

  /** Its cover still, when one was uploaded separately. */
  const primaryCover = (idea: NonNullable<typeof ideas>[number]) => {
    for (const output of outputsByContent.get(idea.id) ?? []) {
      const cover = coverUrl(output, idea);
      if (cover) return cover;
    }
    return coverUrl(idea);
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
                <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                  <PlatformIcon platform={output.platform} size="sm" />
                  <span className="truncate">
                    {socialAccountLabel(output.platform, output.social?.account_name)}
                    {output.format ? ` · ${output.format}` : ""}
                  </span>
                </p>
                <span className="flex-none text-xs text-ink-faint">
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
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Your content pipeline — what&rsquo;s planned, in production and recently published.</p>
        <AddIdeaButton />
      </div>

      {myDrafts.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
            Your ideas · {myDrafts.length} — open one to develop it and send it to production
          </h2>
          <div className="space-y-2">
            {myDrafts.map((idea) => (
              <EditableIdea
                key={idea.id}
                clientId={client.id}
                pillars={pillars ?? []}
                audiences={audienceRows ?? []}
                idea={{
                  id: idea.id,
                  title: idea.title,
                  hook: idea.hook,
                  body: idea.body,
                  notes: idea.notes,
                  pillar_id: idea.pillar_id,
                  audience_id: idea.audience_id,
                  media_url: idea.media_url,
                  thumbnail_url: idea.thumbnail_url,
                  created_at: idea.created_at,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {all.length === 0 ? (
        <EmptyState title="No content yet" description="Planned and published content will appear here as the pipeline fills up. Got a thought? Add a content idea above." />
      ) : (
        <>
          {awaitingApproval.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-ink">Awaiting your approval · {awaitingApproval.length}</h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {canApprove
                    ? "Open each one to watch or view the content, read the copy going to each platform, then approve it or send it back with comments."
                    : "These pieces are waiting for approval — approving content isn't enabled for your account."}
                </p>
              </div>
              {/* Collapsed by default: several pieces can be waiting at once,
                  and a page of fully expanded captions is unreadable. */}
              <div className="space-y-3">
                {awaitingApproval.map((idea) => (
                  <ApprovalCard
                    key={idea.id}
                    ideaId={idea.id}
                    title={idea.title}
                    hook={idea.hook}
                    forYou={idea.approver_user_id === context.userId}
                    canApprove={canApprove}
                    asset={primaryAsset(idea)}
                    cover={primaryCover(idea)}
                    versions={(outputsByContent.get(idea.id) ?? []).map((output) => ({
                      id: output.id,
                      platform: output.platform,
                      accountName: output.social?.account_name ?? null,
                      format: output.format,
                      caption: output.caption,
                      cta: output.cta,
                      scheduledAt: output.status === "scheduled" ? output.scheduled_at : null,
                    }))}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">In the pipeline</h2>
              <div className="space-y-2">
                {upcoming.map((idea) => {
                  const meta = contentStatusMeta(idea.status);
                  const scheduled = (outputsByContent.get(idea.id) ?? []).filter((o) => o.status === "scheduled");
                  const thumb = primaryThumb(idea);
                  return (
                    <div key={idea.id} id={`idea-${idea.id}`} className="scroll-mt-4 rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {thumb && <MediaThumb url={thumb.url} kind={thumb.kind} />}
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
                            <li key={o.id} className="flex items-center gap-2 text-xs text-ink-soft">
                              <PlatformIcon platform={o.platform} size="sm" />
                              <span>
                                {socialAccountLabel(o.platform, o.social?.account_name)} — going out{" "}
                                {o.scheduled_at ? formatDateTime(o.scheduled_at) : "soon"}
                              </span>
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
                  const thumb = primaryThumb(idea);
                  return (
                    <div key={idea.id} id={`idea-${idea.id}`} className="scroll-mt-4 rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {thumb && <MediaThumb url={thumb.url} kind={thumb.kind} />}
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
                                <PlatformIcon platform={o.platform} size="sm" />
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
