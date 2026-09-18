import "server-only";
import type { Database } from "@/lib/database.types";
import { AgentAuthError, type AgentIdentity, assertClientAllowed } from "@/lib/agent/auth";

/**
 * The Actions layer as an agent sees it.
 *
 * Two translations happen here and nowhere else:
 *
 *   1. Duane's operational words → PBOS's stored values. He talks about
 *      "open" and "complete"; the enum says not_started and completed.
 *      Rather than rename what the whole app reads, both spellings are
 *      accepted on the way in and his words are what come back out.
 *
 *   2. "Daniel" → a client id. An agent relaying a sentence someone spoke
 *      has a name, not a UUID, so names resolve here — but only when the
 *      answer is unambiguous. Two clients matching is an error, never a
 *      guess, for the same reason the clip matcher refuses to guess.
 */

type ActionRow = Database["public"]["Tables"]["actions"]["Row"];

/** PBOS enum ← the words Duane uses. */
const STATUS_IN: Record<string, ActionRow["status"]> = {
  open: "not_started",
  not_started: "not_started",
  todo: "not_started",
  in_progress: "in_progress",
  "in progress": "in_progress",
  active: "in_progress",
  waiting: "waiting",
  blocked: "blocked",
  complete: "completed",
  completed: "completed",
  done: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

/** → the words Duane uses, so a reply reads the way he asked the question. */
const STATUS_OUT: Record<ActionRow["status"], string> = {
  not_started: "open",
  in_progress: "in_progress",
  waiting: "waiting",
  blocked: "blocked",
  completed: "complete",
  cancelled: "cancelled",
};

export function parseStatus(raw: unknown, field = "status"): ActionRow["status"] {
  const key = String(raw ?? "").trim().toLowerCase();
  const mapped = STATUS_IN[key];
  if (!mapped) {
    throw new AgentAuthError(
      400,
      "invalid_status",
      `"${String(raw)}" isn't a status for ${field}. Use one of: open, in_progress, waiting, blocked, complete, cancelled.`
    );
  }
  return mapped;
}

const PRIORITIES = ["low", "medium", "high"];
export function parsePriority(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  // "urgent" is what a person says; PBOS's top priority is "high".
  const normalised = value === "urgent" || value === "critical" ? "high" : value;
  if (!PRIORITIES.includes(normalised)) {
    throw new AgentAuthError(400, "invalid_priority", `"${String(raw)}" isn't a priority. Use low, medium or high.`);
  }
  return normalised;
}

const SOURCES = [
  "manual", "meeting", "opportunity", "content", "import",
  "client_confirmation", "signoff", "system",
  "outlook", "chatgpt", "calendar", "agent",
];
export function parseSource(raw: unknown): string {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "agent";
  const value = String(raw).trim().toLowerCase();
  if (!SOURCES.includes(value)) {
    throw new AgentAuthError(400, "invalid_source", `"${String(raw)}" isn't a source. Use one of: ${SOURCES.join(", ")}.`);
  }
  return value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(raw: unknown, field: string): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const value = String(raw).trim();
  if (!DATE_RE.test(value)) {
    throw new AgentAuthError(400, "invalid_date", `${field} must be YYYY-MM-DD — got "${value}".`);
  }
  return value;
}

/**
 * A client id from either a UUID or a name.
 *
 * Exact (case-insensitive) name wins. Failing that, a unique containing
 * match. Two matches is an error — an agent acting on "Daniel" must not
 * quietly pick one of two Daniels.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the service client's generics don't survive being passed around
  supabase: any,
  identity: AgentIdentity,
  raw: unknown
): Promise<{ id: string; name: string }> {
  const value = String(raw ?? "").trim();
  if (!value) throw new AgentAuthError(400, "client_required", "Say which client this is for.");

  if (UUID_RE.test(value)) {
    const { data } = await supabase.from("clients").select("id,name").eq("id", value).maybeSingle();
    if (!data) throw new AgentAuthError(404, "client_not_found", `No client with id ${value}.`);
    assertClientAllowed(identity, data.id);
    return data;
  }

  const { data: all } = await supabase.from("clients").select("id,name");
  const clients: { id: string; name: string }[] = all ?? [];
  const lower = value.toLowerCase();

  const exact = clients.filter((c) => c.name.toLowerCase() === lower);
  const partial = exact.length > 0 ? exact : clients.filter((c) => c.name.toLowerCase().includes(lower));

  if (partial.length === 0) {
    throw new AgentAuthError(404, "client_not_found", `No client matching "${value}".`);
  }
  if (partial.length > 1) {
    throw new AgentAuthError(
      409,
      "client_ambiguous",
      `"${value}" matches ${partial.length} clients: ${partial.map((c) => c.name).join(", ")}. Use the exact name or the client id.`
    );
  }
  assertClientAllowed(identity, partial[0]!.id);
  return partial[0]!;
}

export interface SerialisedAction {
  id: string;
  client_id: string;
  client_name: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string | null;
  due_date: string | null;
  waiting_on: string | null;
  source: string;
  source_reference: string | null;
  completion_evidence: string | null;
  created_by_agent: boolean;
  last_checked_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** True when it's due before today and not finished — saves the agent
   * recomputing "overdue" from a date and a status every time. */
  overdue: boolean;
}

const OPEN_STATUSES: ActionRow["status"][] = ["not_started", "in_progress", "waiting", "blocked"];

export function serialiseAction(
  row: ActionRow & { client?: { name: string } | null },
  today: string
): SerialisedAction {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client?.name ?? null,
    title: row.title,
    description: row.description,
    status: STATUS_OUT[row.status],
    priority: row.priority,
    owner: row.owner_name,
    due_date: row.due_date,
    waiting_on: row.waiting_on || null,
    source: row.source,
    source_reference: row.source_reference || null,
    completion_evidence: row.completion_evidence || null,
    created_by_agent: row.created_by_agent,
    last_checked_at: row.last_checked_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    overdue: Boolean(row.due_date && row.due_date < today && OPEN_STATUSES.includes(row.status)),
  };
}

export const OPEN_STATUS_VALUES = OPEN_STATUSES;

/** Today in the operator's timezone, not the server's. */
export function todayInLondon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export type { ActionRow };
