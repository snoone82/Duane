import { NextResponse, type NextRequest } from "next/server";
import { AgentAuthError, authenticateAgent, scopedClientIds } from "@/lib/agent/auth";
import {
  OPEN_STATUS_VALUES,
  parseDate,
  parsePriority,
  parseSource,
  parseStatus,
  resolveClient,
  serialiseAction,
  todayInLondon,
} from "@/lib/agent/actions";

/**
 * The Actions layer, for an authorised agent.
 *
 *   GET  /api/agent/actions   list / filter
 *   POST /api/agent/actions   create one
 *
 * Duane's V1: "Read PBOS → reason about what is happening → update PBOS →
 * check later → verify completion → close or escalate." This is the read and
 * the create; the update is the [id] route beside it.
 *
 * Every query is narrowed to the token's clients by hand. That is not
 * belt-and-braces — these routes run on the service key, so RLS is not
 * filtering anything underneath.
 */

export const maxDuration = 30;

function fail(error: unknown) {
  if (error instanceof AgentAuthError) {
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ ok: false, error: "internal_error", message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "actions:read");
    const params = request.nextUrl.searchParams;
    const today = todayInLondon();

    let query = supabase
      .from("actions")
      .select("*, client:clients(name)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    const allowed = scopedClientIds(identity);
    if (allowed) query = query.in("client_id", allowed);

    const clientParam = params.get("client");
    if (clientParam) {
      const client = await resolveClient(supabase, identity, clientParam);
      query = query.eq("client_id", client.id);
    }

    // due=today | overdue | week — the three questions the Daily Command
    // Centre actually asks.
    const due = params.get("due");
    if (due === "today") {
      query = query.eq("due_date", today).in("status", OPEN_STATUS_VALUES);
    } else if (due === "overdue") {
      query = query.lt("due_date", today).in("status", OPEN_STATUS_VALUES);
    } else if (due === "week") {
      const weekEnd = new Date(`${today}T00:00:00Z`);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
      query = query.gte("due_date", today).lte("due_date", weekEnd.toISOString().slice(0, 10)).in("status", OPEN_STATUS_VALUES);
    }

    const status = params.get("status");
    if (status === "open") {
      // "Open" as a question means "not finished", not the single state.
      query = query.in("status", OPEN_STATUS_VALUES);
    } else if (status) {
      query = query.eq("status", parseStatus(status));
    }

    const owner = params.get("owner");
    if (owner) query = query.ilike("owner_name", `%${owner}%`);

    const waitingOn = params.get("waiting_on");
    if (waitingOn) query = query.ilike("waiting_on", `%${waitingOn}%`);

    // Free-text, so an agent can find "the Facebook action" from a sentence.
    const q = params.get("q");
    if (q) query = query.ilike("title", `%${q}%`);

    const since = params.get("since");
    if (since) {
      if (Number.isNaN(Date.parse(since))) {
        throw new AgentAuthError(400, "invalid_since", "`since` must be an ISO timestamp.");
      }
      query = query.gt("updated_at", new Date(since).toISOString());
    }

    const limitRaw = Number(params.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 100;
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new AgentAuthError(500, "query_failed", error.message);

    const actions = (data ?? []).map((row) => serialiseAction(row, today));
    return NextResponse.json({
      ok: true,
      today,
      count: actions.length,
      actions,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "actions:write");
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new AgentAuthError(400, "invalid_body", "Send a JSON object.");
    }

    const title = String(body.title ?? "").trim();
    if (!title) throw new AgentAuthError(400, "title_required", "An action needs a title.");

    const client = await resolveClient(supabase, identity, body.client ?? body.client_id);

    // PBOS requires an owner (actions_owner_present). An agent relaying a
    // commitment knows a name, not a PBOS user, so the name is what's stored
    // — same as the rest of the app allows.
    const owner = String(body.owner ?? body.owner_name ?? "").trim();
    if (!owner) throw new AgentAuthError(400, "owner_required", "Say who owns this action.");

    const status = body.status === undefined ? "not_started" : parseStatus(body.status);
    const waitingOn = String(body.waiting_on ?? "").trim();
    if (status === "waiting" && !waitingOn) {
      throw new AgentAuthError(400, "waiting_on_required", 'A "waiting" action needs waiting_on — who is it waiting on?');
    }

    const insert = {
      client_id: client.id,
      title,
      description: String(body.description ?? body.notes ?? "").trim(),
      owner_name: owner,
      status,
      priority: body.priority === undefined ? "medium" : parsePriority(body.priority),
      due_date: parseDate(body.due_date ?? body.due, "due_date"),
      waiting_on: waitingOn,
      source: parseSource(body.source),
      source_reference: String(body.source_reference ?? "").trim(),
      completion_evidence: String(body.completion_evidence ?? "").trim(),
      created_by_agent: body.created_by_agent === undefined ? true : Boolean(body.created_by_agent),
      last_checked_at: new Date().toISOString(),
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    };

    const { data, error } = await supabase.from("actions").insert(insert).select("*, client:clients(name)").single();
    if (error) throw new AgentAuthError(500, "insert_failed", error.message);

    return NextResponse.json({ ok: true, action: serialiseAction(data, todayInLondon()) }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
