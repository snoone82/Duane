import { NextResponse, type NextRequest } from "next/server";
import { AgentAuthError, OPAQUE_FAILURE, assertClientAllowed, authenticateAgent } from "@/lib/agent/auth";
import {
  getClientContentStrategy,
  getClientOverview,
  getClientProfile,
  getClientSocialProfiles,
  resolveClientRef,
} from "@/lib/agent/clients";

/**
 * GET /api/agent/clients/{id}/{section}
 *
 * Phase one of Duane's Command Centre: overview, profile, content-strategy,
 * social-profiles. Enough to answer "using Daniel's positioning, audiences
 * and content guidelines, give me three LinkedIn ideas" and "what is his
 * current LinkedIn bio?" without anything being pasted into the chat.
 *
 * One route rather than four near-identical files. The sections share their
 * auth, their client resolution and their error handling entirely; the only
 * thing that differs is which reader runs, so splitting them would be four
 * copies of the same twenty lines.
 *
 * `id` accepts a name as well as an id, because an agent relaying a spoken
 * sentence has "Daniel". Resolution refuses to guess between two matches.
 */

export const maxDuration = 30;

const SECTIONS = {
  overview: getClientOverview,
  profile: getClientProfile,
  "content-strategy": getClientContentStrategy,
  "social-profiles": getClientSocialProfiles,
} as const;

type Section = keyof typeof SECTIONS;

function fail(error: unknown) {
  if (error instanceof AgentAuthError) {
    if (error.detail) console.error("[agent-api]", error.code, error.detail);
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  console.error("[agent-api] unhandled:", error);
  return NextResponse.json({ ok: false, error: "internal_error", message: OPAQUE_FAILURE }, { status: 500 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; section: string }> }) {
  try {
    const { identity, supabase } = await authenticateAgent(request, "clients:read");
    const { id, section } = await context.params;

    if (!(section in SECTIONS)) {
      throw new AgentAuthError(
        404,
        "unknown_section",
        `"${section}" isn't a client section. Use one of: ${Object.keys(SECTIONS).join(", ")}.`
      );
    }

    const client = await resolveClientRef(supabase, identity, id);
    assertClientAllowed(identity, client.id);

    const data = await SECTIONS[section as Section](supabase, client.id);

    return NextResponse.json({
      ok: true,
      // Echoed on every response so the agent can confirm it read the client
      // it meant to, and can use the canonical id from here on.
      client: { id: client.id, name: client.name },
      section,
      data,
    });
  } catch (error) {
    return fail(error);
  }
}
