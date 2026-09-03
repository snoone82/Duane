/** File-kind sniffing for signed storage URLs (extension before the query
 * string) — server-safe, unlike the helpers in the client-side media slot. */
export function isImageUrl(url: string): boolean {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif)$/.test(path);
}

/** The best small preview for a platform version: its thumbnail, or the
 * asset itself when that's an image. Null when there's nothing to show. */
export function thumbUrl(output: { thumbnail_url: string | null; media_url: string | null }): string | null {
  if (output.thumbnail_url) return output.thumbnail_url;
  if (output.media_url && isImageUrl(output.media_url)) return output.media_url;
  return null;
}

export function isVideoUrl(url: string): boolean {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  return /\.(mp4|mov|m4v|webm|avi|mkv)$/.test(path);
}

export interface MediaPreview {
  url: string;
  kind: "image" | "video";
}

/** The media fields shared by content_ideas and content_outputs. */
interface PreviewHolder {
  thumbnail_url?: string | null;
  thumbnail_source_url?: string | null;
  media_url?: string | null;
  media_source_url?: string | null;
  media_path?: string | null;
}

const pick = (value: string | null | undefined): string => (value ?? "").trim();
const hasMedia = (h: PreviewHolder | null | undefined): h is PreviewHolder =>
  Boolean(h && (pick(h.media_path) || pick(h.media_url) || pick(h.media_source_url)));

/**
 * The small preview for a platform version on the client calendar and
 * content pages (Duane, 3 Sep 2026): a real thumbnail if one exists, else
 * the asset itself — an image directly, a video as a first-frame preview.
 *
 * Follows the same inheritance as publishing: the version's own media wins,
 * otherwise it shows the master media from the content idea. Without that
 * a version inheriting master media looked like it had no media at all.
 */
export function mediaPreview(output: PreviewHolder, idea?: PreviewHolder | null): MediaPreview | null {
  for (const holder of [output, idea]) {
    const thumb = pick(holder?.thumbnail_url) || pick(holder?.thumbnail_source_url);
    if (thumb) return { url: thumb, kind: "image" };
  }
  const holder = hasMedia(output) ? output : hasMedia(idea) ? idea : null;
  if (!holder) return null;
  // The uploaded copy is a signed URL we know the browser can fetch; an
  // external link may be a viewer page, so it's the fallback.
  const url = pick(holder.media_url) || pick(holder.media_source_url);
  if (!url) return null;
  const path = pick(holder.media_path);
  if (isImageUrl(url) || isImageUrl(path)) return { url, kind: "image" };
  if (isVideoUrl(url) || isVideoUrl(path)) return { url, kind: "video" };
  return null;
}
