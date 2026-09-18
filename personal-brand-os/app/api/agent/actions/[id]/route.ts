import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { AgentAuthError, OPAQUE_FAILURE, assertClientAllowed, authenticateAgent } from "@/lib/agent/auth";
import {
  parseDate,
  parsePriority,
  parseSource,
  parseStatus,
  serialiseAction,
  todayInLondon,
  type ActionRow,
} from "@/lib/agent/actions";

/**
 * One Action.
 *
 *   GET   /api/agent/actions/:id   read it
 *   PATCH /api/agent/actions/:id   change it
 *
 * PATCH is deliberately a partial update: an agent saying "Facebook is now
 * waiting on Daniel" should change two fields and leave the rest of the
 * record exactly as it was. Anything not named in the body is untouched —
 * which is also what makes Duane's test 3 ("no duplicate Action is created")
 * true by construction.
 */

export const maxDuration = 30;

/**
 * Nothing about an internal failure crosses this boundary.
 *
 * These routes hold the service-role key, and a raw error from that client
 * can carry the credential itself (it has), another client's data, or the
 * schema. So only errors we deliberately worded are returned; everything
 * else becomes an opaque 500 and the detail goes to the server log, where
 * Vercel keeps it and the public does not see it.
 */
function fail(error: unknown) {
  if (error instanceof AgentAuthError) {
    if (error.detail) console.error("[agent-api]", error.code, error.detail);
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  console.error("[agent-api] unhandled:", error);
  return NextResponse.json({ ok: false, error: "internal_error", message: OPAQUE_FAILURE }, { status: 500 });
}

async function loadAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- service client generics don't survive being passed around
  supabase: any,
  id: string
): Promise<ActionRow & { client?: { name: string } | null }> {
  const { data, error } = await supabase.from("actions").select("*, client:clients(name)").eq("id", id).maybeSingle();
  if (error) throw new AgentAuthError(500, "query_failed", OPAQUE_FAILURE, error.message);
  if (!data) throw new AgentAuthError(404, "action_not_found", `No action with id ${id}.`);
  return data;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "actions:read");
    const { id } = await context.params;
    const action = await loadAction(supabase, id);
    assertClientAllowed(identity, action.client_id);
    return NextResponse.json({ ok: true, action: serialiseAction(action, todayInLondon()) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "actions:write");
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new AgentAuthError(400, "invalid_body", "Send a JSON object.");
    }

    const current = await loadAction(supabase, id);
    assertClientAllowed(identity, current.client_id);

    // Typed as the table's own Update shape so a stray field can't be smuggled
    // in from the request body — the service key would happily write it.
    const patch: Database["public"]["Tables"]["actions"]["Update"] = {
      // Every agent write is a check, so the timestamp moves even when
      // nothing else does. That is what makes "promised today, last verified
      // on Tuesday" answerable later.
      last_checked_at: new Date().toISOString(),
    };

    if ("status" in body) {
      const status = parseStatus(body.status);
      patch.status = status;
      // Completion carries a time, and clearing it matters just as much —
      // an action reopened from Complete must not keep the old stamp.
      patch.completed_at = status === "completed" ? new Date().toISOString() : null;
      // Leaving "waiting" clears who it was waiting on, unless this same
      // call says otherwise.
      if (status !== "waiting" && !("waiting_on" in body)) patch.waiting_on = "";
    }

    if ("waiting_on" in body) {
      const waitingOn = String(body.waiting_on ?? "").trim();
      patch.waiting_on = waitingOn;
      // Naming someone to wait on, without saying so, means waiting.
      if (waitingOn && !("status" in body)) patch.status = "waiting";
    }

    if ("due_date" in body || "due" in body) {
      patch.due_date = parseDate(body.due_date ?? body.due, "due_date");
    }
    if ("priority" in body) patch.priority = parsePriority(body.priority);
    if ("owner" in body || "owner_name" in body) {
      const owner = String(body.owner ?? body.owner_name ?? "").trim();
      if (!owner) throw new AgentAuthError(400, "owner_required", "An action must have an owner.");
      patch.owner_name = owner;
    }
    if ("title" in body) {
      const title = String(body.title ?? "").trim();
      if (!title) throw new AgentAuthError(400, "title_required", "An action needs a title.");
      patch.title = title;
    }
    if ("description" in body) patch.description = String(body.description ?? "").trim();
    if ("source" in body) patch.source = parseSource(body.source);
    if ("source_reference" in body) patch.source_reference = String(body.source_reference ?? "").trim();
    if ("completion_evidence" in body) patch.completion_evidence = String(body.completion_evidence ?? "").trim();

    // Appending a note keeps the history rather than replacing it — the
    // point of provenance is that you can read back how it got here.
    const note = String(body.append_note ?? "").trim();
    if (note) {
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const existing = typeof patch.description === "string" ? patch.description : current.description;
      patch.description = [existing, `[${stamp}] ${note}`].filter(Boolean).join("\n\n");
    }

    // last_checked_at alone is a legitimate call — "I looked, nothing had
    // changed" is information, and it is how a commitment gets marked as
    // verified rather than merely un-actioned.
    const { data, error } = await supabase
      .from("actions")
      .update(patch)
      .eq("id", id)
      .select("*, client:clients(name)")
      .single();
    if (error) throw new AgentAuthError(500, "update_failed", OPAQUE_FAILURE, error.message);

    return NextResponse.json({ ok: true, action: serialiseAction(data, todayInLondon()) });
  } catch (error) {
    return fail(error);
  }
}
