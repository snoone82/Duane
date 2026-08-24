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
