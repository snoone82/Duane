/**
 * External media on a platform version (Duane, 1 Sep 2026).
 *
 * Ayrshare fetches media by URL, so the cleanest route for a 145 MB video is
 * to host it where it already lives and hand Ayrshare the link — no
 * download, compress, re-upload round trip.
 *
 * The catch, and the reason this module exists: a Teams or SharePoint
 * "share" link is not a media URL. It's an HTML page behind Microsoft
 * sign-in. Ayrshare fetching it gets a login page, not a video, and the post
 * fails at publish time with something unhelpful. Better to say so while the
 * link is being pasted.
 */

export interface MediaSourceVerdict {
  kind: "ok" | "warn" | "bad";
  message: string;
}

/** Hosts whose ordinary share links are viewer pages rather than files. */
const VIEWER_HOSTS: { match: RegExp; name: string; advice: string }[] = [
  {
    match: /(^|\.)sharepoint\.com$/i,
    name: "SharePoint",
    advice:
      "A SharePoint share link opens a viewer page behind your Microsoft sign-in, so Ayrshare can't read the file itself. Use a link that downloads the file directly, or upload the clip here instead.",
  },
  {
    match: /(^|\.)teams\.microsoft\.com$/i,
    name: "Teams",
    advice:
      "A Teams link points at a conversation or viewer, not the file. Open the file in SharePoint or OneDrive and get a direct download link, or upload the clip here.",
  },
  {
    match: /(^|\.)-my\.sharepoint\.com$|(^|\.)onedrive\.live\.com$/i,
    name: "OneDrive",
    advice:
      "A OneDrive share link opens a viewer page rather than the file. Use a direct download link, or upload the clip here.",
  },
  {
    match: /(^|\.)drive\.google\.com$/i,
    name: "Google Drive",
    advice:
      "A Google Drive share link opens a viewer page. Use a direct download link, or upload the clip here.",
  },
  {
    match: /(^|\.)dropbox\.com$/i,
    name: "Dropbox",
    advice:
      "A Dropbox share link opens a preview page. Dropbox links ending ?dl=1 usually serve the file directly — try that.",
  },
];

const MEDIA_EXTENSIONS = /\.(mp4|mov|m4v|webm|jpg|jpeg|png|gif|webp)(\?|$)/i;

/**
 * What we can tell from the URL alone, before asking the network. Cheap,
 * instant, and catches the case Duane will actually hit.
 */
export function inspectMediaUrl(raw: string): MediaSourceVerdict | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { kind: "bad", message: "That doesn't look like a full web address — it needs to start with https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "bad", message: "The link needs to be an http(s) web address." };
  }

  const viewer = VIEWER_HOSTS.find((h) => h.match.test(url.hostname));
  if (viewer) return { kind: "warn", message: viewer.advice };

  if (MEDIA_EXTENSIONS.test(url.pathname)) {
    return { kind: "ok", message: "Looks like a direct media file. Check it to be sure." };
  }
  return {
    kind: "warn",
    message: "This doesn't end in a media file extension. It may still work — use Check link to find out before scheduling.",
  };
}

/**
 * Which URL publishing should actually send. External wins when set: it's
 * the full-size asset, where an upload may have been compressed to fit.
 */
export function resolveMediaUrl(output: { media_source_url?: string | null; media_url?: string | null }): string | null {
  const external = (output.media_source_url ?? "").trim();
  if (external) return external;
  const uploaded = (output.media_url ?? "").trim();
  return uploaded || null;
}

export function resolveThumbnailUrl(output: {
  thumbnail_source_url?: string | null;
  thumbnail_url?: string | null;
}): string | null {
  const uploaded = (output.thumbnail_url ?? "").trim();
  if (uploaded) return uploaded;
  const external = (output.thumbnail_source_url ?? "").trim();
  return external || null;
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i;

/**
 * Is this platform version's media a video?
 *
 * Ayrshare normally infers the type from the URL, but a Supabase signed URL
 * ends in a token rather than ".mp4" — so it has to be told. The stored
 * object path keeps its real extension, which is the reliable signal.
 */
export function isVideoMedia(
  output: { media_path?: string | null; media_source_url?: string | null; format?: string | null },
  resolvedUrl: string | null
): boolean {
  if (output.media_path && VIDEO_EXTENSIONS.test(output.media_path)) return true;
  if (resolvedUrl && VIDEO_EXTENSIONS.test(resolvedUrl)) return true;
  // Last resort: the version's own format field ("Reel", "Short", "Video").
  const format = (output.format ?? "").toLowerCase();
  return /reel|short|video|clip/.test(format);
}

// ---------------------------------------------------------------------------
// Master media inheritance (Duane, 3 Sep 2026)
// ---------------------------------------------------------------------------

/** The media fields both content_ideas and content_outputs carry. */
export interface MediaHolder {
  media_path?: string | null;
  media_source_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_source_url?: string | null;
}

export type MediaOrigin = "override" | "master" | "none";

export interface ResolvedMedia {
  /** Where this media came from — drives the label on each platform version. */
  origin: MediaOrigin;
  /** The durable Supabase object path, when the media is an upload. */
  path: string | null;
  /** Externally hosted media, when that's what was supplied instead. */
  sourceUrl: string | null;
  thumbnailPath: string | null;
  thumbnailSourceUrl: string | null;
}

const has = (holder: MediaHolder | null | undefined): boolean =>
  Boolean(holder && ((holder.media_path ?? "").trim() || (holder.media_source_url ?? "").trim()));

/**
 * Which media a platform version should actually publish.
 *
 * Duane's rule, and he chose automatic inheritance over a copy button: a
 * version with media of its own uses it; otherwise it inherits the master
 * asset from the content idea. Nothing is duplicated in storage — the
 * version simply resolves to the idea's object path.
 */
export function resolveMedia(output: MediaHolder, idea: MediaHolder | null | undefined): ResolvedMedia {
  const pick = (holder: MediaHolder, origin: MediaOrigin): ResolvedMedia => ({
    origin,
    path: (holder.media_path ?? "").trim() || null,
    sourceUrl: (holder.media_source_url ?? "").trim() || null,
    thumbnailPath: (holder.thumbnail_path ?? "").trim() || null,
    thumbnailSourceUrl: (holder.thumbnail_source_url ?? "").trim() || null,
  });

  if (has(output)) return pick(output, "override");
  if (has(idea)) return pick(idea!, "master");
  return { origin: "none", path: null, sourceUrl: null, thumbnailPath: null, thumbnailSourceUrl: null };
}

/** Label for the platform version, in Duane's words. */
export function mediaOriginLabel(origin: MediaOrigin): string {
  if (origin === "override") return "Platform override";
  if (origin === "master") return "Using master media";
  return "No media yet";
}
