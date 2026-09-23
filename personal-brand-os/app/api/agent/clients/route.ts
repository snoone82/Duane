import { NextResponse, type NextRequest } from "next/server";
import { AgentAuthError, OPAQUE_FAILURE, authenticateAgent } from "@/lib/agent/auth";
import { searchClients } from "@/lib/agent/clients";

/**
 * GET /api/agent/clients — find a client, and get its canonical id.
 *
 * Duane: "The GPT should be able to search by human-readable name, but once
 * identified it should work from the PBOS ID." This is the first half. It
 * always returns a list, even for one match, so the agent has to look at
 * what came back rather than assuming.
 */

export const maxDuration = 30;

function fail(error: unknown) {
  if (error instanceof AgentAuthError) {
    if (error.detail) console.error("[agent-api]", error.code, error.detail);
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  console.error("[agent-api] unhandled:", error);
  return NextResponse.json({ ok: false, error: "internal_error", message: OPAQUE_FAILURE }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "clients:read");
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const clients = await searchClients(supabase, identity, query);
    return NextResponse.json({ ok: true, count: clients.length, clients });
  } catch (error) {
    return fail(error);
  }
}
