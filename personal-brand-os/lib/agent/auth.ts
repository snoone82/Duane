import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Authenticating an automated agent (ChatGPT / Work) into PBOS.
 *
 * Duane: "The agent should authenticate independently rather than bypassing
 * user permissions." So a token is its own identity, with its own scopes and
 * its own client restriction — not a person's login borrowed by a robot.
 *
 * ── On the service-role key ──────────────────────────────────────────────
 * These routes are the ONLY place in PBOS that uses it, and that is
 * deliberate. It bypasses row-level security completely, which means the
 * database stops being the thing that keeps one client's data away from
 * another — this file and the route handlers become that thing instead.
 *
 * Two rules follow, and everything here exists to enforce them:
 *
 *   1. Every query is scoped by client explicitly, in code, because nothing
 *      underneath will do it any more (see assertClientAllowed).
 *   2. The key never leaves this module's client factory. It is not exported,
 *      not reachable from a Server Action, and `server-only` makes an
 *      accidental import from a client component a build error rather than a
 *      leaked secret.
 */

const TOKEN_PREFIX = "pbos_";

export type AgentScope = "actions:read" | "actions:write" | "clients:read";

export interface AgentIdentity {
  tokenId: string;
  name: string;
  scopes: string[];
  /** Null means every client; otherwise only these. */
  clientIds: string[] | null;
}

export class AgentAuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The token as stored. Never store or log the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Service-role Supabase client. RLS does not apply to anything done with it,
 * so it is confined to this module and handed only to the agent routes.
 */
export function createAgentClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new AgentAuthError(
      503,
      "not_configured",
      "The agent API isn't configured on this deployment — SUPABASE_SERVICE_ROLE_KEY is not set in Vercel."
    );
  }
  return createServiceClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Constant-time compare so a wrong token can't be found a byte at a time. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Identify the caller, or throw. Checks the token is known, live, and carries
 * the scope this route needs — before the route touches any data.
 */
export async function authenticateAgent(
  request: Request,
  required: AgentScope
): Promise<{ identity: AgentIdentity; supabase: ReturnType<typeof createAgentClient> }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    throw new AgentAuthError(401, "unauthenticated", "Send a PBOS agent token as `Authorization: Bearer pbos_…`.");
  }

  const supabase = createAgentClient();
  const presented = hashToken(token);

  const { data: row, error } = await supabase
    .from("agent_tokens")
    .select("id,name,token_hash,scopes,client_ids,revoked_at")
    .eq("token_hash", presented)
    .maybeSingle();
  if (error) throw new AgentAuthError(500, "lookup_failed", error.message);

  // Compare again in constant time. The lookup above is an indexed equality
  // match on a hash, which is fine, but this keeps the decision itself
  // timing-independent rather than relying on the database's behaviour.
  if (!row || !hashesMatch(row.token_hash, presented)) {
    throw new AgentAuthError(401, "unknown_token", "That token isn't recognised.");
  }
  if (row.revoked_at) {
    throw new AgentAuthError(401, "revoked_token", "That token has been revoked.");
  }
  if (!row.scopes.includes(required)) {
    throw new AgentAuthError(
      403,
      "missing_scope",
      `This token doesn't carry the "${required}" scope. It has: ${row.scopes.join(", ") || "none"}.`
    );
  }

  // Best effort — a failed stamp must never block a valid request.
  void supabase.from("agent_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

  return {
    identity: {
      tokenId: row.id,
      name: row.name,
      scopes: row.scopes,
      clientIds: row.client_ids && row.client_ids.length > 0 ? row.client_ids : null,
    },
    supabase,
  };
}

/**
 * The rule that replaces RLS. Every route that names a client passes through
 * here first; with the service key nothing else will stop a token reading a
 * client it was never given.
 */
export function assertClientAllowed(identity: AgentIdentity, clientId: string): void {
  if (identity.clientIds && !identity.clientIds.includes(clientId)) {
    throw new AgentAuthError(403, "client_out_of_scope", "This token isn't scoped to that client.");
  }
}

/** Narrow a list query to the token's clients. Null = unrestricted. */
export function scopedClientIds(identity: AgentIdentity): string[] | null {
  return identity.clientIds;
}
