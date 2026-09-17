import { PortalContentApproval } from "@/components/portal/PortalContentApproval";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { PlatformIcon, PlatformIconRow } from "@/components/ui/PlatformIcon";
import { EditablePlatformCopy } from "@/components/portal/EditablePlatformCopy";
import { formatDateTime } from "@/lib/format";
import type { MediaPreview } from "@/lib/media";

/**
 * One piece of content awaiting the client's approval.
 *
 * Duane's journey: see what needs approval → open a piece → watch or view
 * it → review each platform version → approve or request changes →
 * collapse it and move to the next. So it is collapsed by default; several
 * items waiting at once must not become one enormous page of captions.
 *
 * `<details>` rather than React state on purpose — it opens without
 * JavaScript, gets keyboard and screen-reader behaviour for free, and the
 * only interactive part that genuinely needs a client component is the
 * approve/request-changes pair, which already is one.
 *
 * The card carries `review-surface`, the light token set. Everything inside
 * it — buttons, the comments box, notices — re-skins itself, because the
 * whole app routes colour through the same token names.
 */

export interface ApprovalVersion {
  id: string;
  platform: string;
  accountName: string | null;
  format: string;
  caption: string;
  cta: string;
  scheduledAt: string | null;
}

export function ApprovalCard({
  ideaId,
  title,
  hook,
  forYou,
  canApprove,
  asset,
  cover,
  versions,
}: {
  ideaId: string;
  title: string;
  hook: string;
  /** This client is the named approver — worth saying so plainly. */
  forYou: boolean;
  canApprove: boolean;
  /** The asset itself — a video stays a video so it can be played here. */
  asset: MediaPreview | null;
  /** The cover still, when one was uploaded. Shown in the collapsed row and
   * as the video's poster, which is where "the cover is visible" belongs —
   * repeating it beside the player would just be the same picture twice. */
  cover: string | null;
  versions: ApprovalVersion[];
}) {
  const thumb = cover ? { url: cover, kind: "image" as const } : asset;
  return (
    <details
      id={`idea-${ideaId}`}
      className="review-surface group scroll-mt-4 overflow-hidden rounded-xl border border-border shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
    >
      {/* ---- Collapsed row: thumbnail, title, platforms, status ---- */}
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-surface-muted sm:p-4">
        {thumb ? (
          <MediaThumb url={thumb.url} kind={thumb.kind} />
        ) : (
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-md border border-border bg-surface-muted text-xs text-ink-faint">
            —
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <PlatformIconRow platforms={versions.map((v) => v.platform)} />
            <span className="text-xs text-ink-faint">
              {versions.length} version{versions.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>

        <span className="flex flex-none items-center gap-2">
          <span
            className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${
              forYou ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-soft"
            }`}
          >
            {forYou ? "For you to approve" : "Awaiting approval"}
          </span>
          {/* The expand control, labelled rather than a bare chevron. */}
          <span className="inline-flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1 text-xs font-medium text-ink">
            <span className="group-open:hidden">Review</span>
            <span className="hidden group-open:inline">Close</span>
            <span aria-hidden className="transition-transform duration-150 group-open:rotate-180">
              ▾
            </span>
          </span>
        </span>
      </summary>

      {/* ---- Expanded: the asset, then every platform version ---- */}
      <div className="border-t border-border bg-surface px-3 pb-4 pt-4 sm:px-5">
        {hook && <p className="review-measure mb-4 text-sm italic text-ink-soft">&ldquo;{hook}&rdquo;</p>}

        {asset && (
          <div className="mb-5">
            {asset.kind === "video" ? (
              // Playable in place — Duane: "the client should be able to
              // play the video directly inside PBOS". preload=metadata so a
              // page of collapsed cards doesn't pull every video down.
              <video
                src={asset.url}
                controls
                preload="metadata"
                playsInline
                {...(cover ? { poster: cover } : {})}
                className="max-h-[26rem] w-full rounded-lg border border-border bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, next/image can't optimise it
              <img
                src={asset.url}
                alt={title}
                className="max-h-[26rem] w-full rounded-lg border border-border bg-surface-muted object-contain"
              />
            )}
          </div>
        )}

        <h3 className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">Platform versions</h3>

        <div className="divide-y divide-border">
          {versions.map((version) => (
            <section key={version.id} className="py-4">
              <div className="flex items-start gap-3">
                <PlatformIcon platform={version.platform} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{version.accountName || version.platform}</p>
                  <p className="text-xs text-ink-faint">
                    {[version.accountName ? version.platform : null, version.format]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {version.scheduledAt && (
                  <span className="flex-none text-xs text-ink-faint">{formatDateTime(version.scheduledAt)}</span>
                )}
              </div>

              {/* The copy is the client's to correct; the video is not.
                  See EditablePlatformCopy. */}
              <EditablePlatformCopy
                outputId={version.id}
                caption={version.caption}
                platformLabel={version.accountName ? `${version.platform} — ${version.accountName}` : version.platform}
                canEdit={canApprove}
              />

              {version.cta && (
                <p className="review-measure mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                  <span className="font-medium text-ink">Call to action · </span>
                  {version.cta}
                </p>
              )}
            </section>
          ))}
        </div>

        {canApprove ? (
          <>
            <p className="mt-4 text-xs text-ink-faint">
              Wording is yours to change above — edit any platform and save. Request changes is for the video itself.
            </p>
            <PortalContentApproval ideaId={ideaId} />
          </>
        ) : (
          <p className="mt-4 border-t border-border pt-4 text-xs text-ink-faint">
            Approving content isn&rsquo;t enabled for your account — ask your account manager if that&rsquo;s not right.
          </p>
        )}
      </div>
    </details>
  );
}
