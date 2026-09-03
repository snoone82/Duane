"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { inspectMediaUrl } from "@/lib/media-source";

export interface MediaCheckResult {
  reachable: boolean;
  contentType: string | null;
  sizeBytes: number | null;
  status: number | null;
  verdict: "ok" | "warn" | "bad";
  message: string;
}

function pretty(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ask the URL what it actually is, rather than guessing from its shape.
 * Ayrshare has to fetch this link anonymously from its own servers, so the
 * only meaningful test is an anonymous fetch — which is exactly what this
 * does. A SharePoint link returns HTML and a sign-in, and that shows up here
 * as "this is a web page, not a video" instead of a failed post later.
 */
export async function checkMediaUrl(url: string): Promise<ActionResult<MediaCheckResult>> {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return { ok: false, message: "Paste a media URL first." };

  const shape = inspectMediaUrl(trimmed);
  if (shape?.kind === "bad") return { ok: false, message: shape.message };

  return runAction(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // Range request: enough to read the headers without pulling a 145 MB
      // file through the server.
      const response = await fetch(trimmed, {
        method: "GET",
        headers: { Range: "bytes=0-0", "User-Agent": "PBOS-media-check" },
        redirect: "follow",
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type");
      const rangeTotal = response.headers.get("content-range")?.split("/")[1];
      const sizeBytes = rangeTotal && /^\d+$/.test(rangeTotal)
        ? Number(rangeTotal)
        : Number(response.headers.get("content-length")) || null;

      const isMedia = Boolean(contentType && /^(video|image)\//i.test(contentType));
      const isHtml = Boolean(contentType && /text\/html/i.test(contentType));

      if (!response.ok && response.status !== 206) {
        return {
          reachable: false,
          contentType,
          sizeBytes,
          status: response.status,
          verdict: "bad" as const,
          message:
            response.status === 401 || response.status === 403
              ? "The link needs a sign-in, so Ayrshare can't fetch it. It has to be publicly reachable without logging in."
              : `The link returned ${response.status}. Ayrshare would get the same, so publishing would fail.`,
        };
      }

      if (isHtml) {
        return {
          reachable: true,
          contentType,
          sizeBytes,
          status: response.status,
          verdict: "bad" as const,
          message:
            "That link serves a web page, not a media file — usually a viewer or sign-in page. Ayrshare would receive the page rather than the video.",
        };
      }

      if (isMedia) {
        // Ayrshare fetching it is only half the story. For Instagram and
        // Facebook, Meta's own crawler retrieves the media during publishing,
        // and it can be blocked where Ayrshare isn't — which produces a 400
        // at the platform with nothing useful attached. So ask as Meta.
        let metaNote = "";
        try {
          const metaResponse = await fetch(trimmed, {
            method: "GET",
            headers: {
              Range: "bytes=0-0",
              "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
            },
            redirect: "follow",
            signal: controller.signal,
          });
          const metaType = metaResponse.headers.get("content-type") ?? "";
          metaNote =
            metaResponse.ok || metaResponse.status === 206
              ? /^(video|image)\//i.test(metaType)
                ? " Meta's crawler can fetch it too, so Instagram and Facebook will be able to read it."
                : ` Meta's crawler reached it but got ${metaType || "an unknown type"} — worth watching if Instagram rejects the post.`
              : ` But Meta's crawler got ${metaResponse.status}, so Instagram and Facebook would fail even though Ayrshare can read it.`;
        } catch {
          metaNote = " Couldn't complete the Meta crawler check — Ayrshare can read it, but Instagram may not.";
        }

        return {
          reachable: true,
          contentType,
          sizeBytes,
          status: response.status,
          verdict: metaNote.startsWith(" But") ? ("warn" as const) : ("ok" as const),
          message: `Good — ${contentType}${sizeBytes ? `, ${pretty(sizeBytes)}` : ""}. Ayrshare can fetch this directly.${metaNote}`,
        };
      }

      return {
        reachable: true,
        contentType,
        sizeBytes,
        status: response.status,
        verdict: "warn" as const,
        message: `Reachable, but it reports itself as ${contentType || "an unknown type"} rather than video or image. It may still work — worth testing on one post before relying on it.`,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        reachable: false,
        contentType: null,
        sizeBytes: null,
        status: null,
        verdict: "bad" as const,
        message: aborted
          ? "The link didn't respond within 12 seconds. Ayrshare would likely time out too."
          : "Couldn't reach that link at all from outside your network. It needs to be publicly accessible.",
      };
    } finally {
      clearTimeout(timer);
    }
  });
}
