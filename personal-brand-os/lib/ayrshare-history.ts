import type { Json } from "@/lib/database.types";

/**
 * The handover record kept on each platform version, and the pure functions
 * over it. No server imports — the Content row reads this in the browser to
 * decide what the publish button should say, and the server actions use the
 * same functions so the two can't disagree about whether a post is queued.
 *
 * Append-only by design. Overwriting ayrshare_post_id is how the first of
 * Jonny's two LinkedIn posts vanished from PBOS's view.
 */

export interface HandoverEntry {
  post_id: string;
  sent_at: string;
  mode: "scheduled" | "immediate";
  scheduled_for: string | null;
  /** null while the post is still queued at Ayrshare. */
  outcome: "live" | "cancelled" | "superseded" | null;
  closed_at: string | null;
}

/** History is jsonb, so treat anything unexpected as "no history". Going via
 * `unknown` is deliberate: Json's recursive shape and a plain interface don't
 * overlap enough for TypeScript to accept a direct narrowing. */
export function readHistory(value: Json | null | undefined): HandoverEntry[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter((entry): entry is HandoverEntry => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
    return typeof (entry as { post_id?: unknown }).post_id === "string";
  });
}

/** The handover Ayrshare may still act on, if there is one. */
export function openHandover(history: HandoverEntry[]): HandoverEntry | null {
  return [...history].reverse().find((entry) => entry.outcome === null) ?? null;
}

export function appendHandover(history: HandoverEntry[], entry: HandoverEntry): Json {
  return [...history, entry] as unknown as Json;
}

/** Close the named handover. Returns new history; never removes an entry. */
export function closeHandover(
  history: HandoverEntry[],
  postId: string,
  outcome: Exclude<HandoverEntry["outcome"], null>
): Json {
  const closedAt = new Date().toISOString();
  return history.map((entry) =>
    entry.post_id === postId && entry.outcome === null ? { ...entry, outcome, closed_at: closedAt } : entry
  ) as unknown as Json;
}
