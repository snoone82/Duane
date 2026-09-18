"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import { hashToken } from "@/lib/agent/auth";

/**
 * Minting and revoking agent tokens.
 *
 * The plain token exists for exactly one render — it is generated here,
 * hashed, and only the hash is stored. Nothing can recover it afterwards,
 * including us, which is the point: a credential that can be read back out
 * of the database is a credential waiting to be copied out of the database.
 *
 * Admin-only, through the ordinary signed-in client under RLS. The service
 * key belongs to the API routes and never comes near this.
 */

export async function createAgentToken(name: string): Promise<ActionResult<string>> {
  const label = name.trim();
  if (!label) return { ok: false, message: "Give the token a name so you know what to revoke later." };

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can create agent tokens." };

  return runAction(async () => {
    // 32 random bytes, base64url — long enough that guessing is not a threat
    // model, prefixed so it is recognisable in a log or a config field.
    const token = `pbos_${randomBytes(32).toString("base64url")}`;
    const supabase = await createClient();
    const { error } = await supabase.from("agent_tokens").insert({
      name: label,
      token_hash: hashToken(token),
      created_by: profile.id,
    });
    if (error) throw new UserFacingError(error.message);
    revalidatePath("/team");
    return token;
  });
}

export async function revokeAgentToken(tokenId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can revoke agent tokens." };

  return runAction(async () => {
    const supabase = await createClient();
    // Revoked rather than deleted: the row is the record of what had access
    // and when it was used, which is worth keeping after the key is dead.
    const { error } = await supabase
      .from("agent_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", tokenId);
    if (error) throw new UserFacingError(error.message);
    revalidatePath("/team");
    return undefined;
  });
}
