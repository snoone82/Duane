"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { previewBlock } from "@/lib/preview";
import { buildStrategySnapshot } from "@/lib/data/signoff";
import type { Json } from "@/lib/database.types";

/** Snapshot the current strategy as a new draft pack (version = max + 1). */
export async function createSignoffPack(clientId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const snapshot = await buildStrategySnapshot(supabase, clientId);
    if (!snapshot) throw new Error("Client not found.");

    const { data: latest } = await supabase
      .from("strategy_signoffs")
      .select("version")
      .eq("client_id", clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("strategy_signoffs").insert({
      client_id: clientId,
      version: (latest?.version ?? 0) + 1,
      snapshot: snapshot as unknown as Json,
      created_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/outputs`);
    return undefined;
  });
}

/** Draft → sent: the pack becomes visible in the client's portal. */
export async function shareSignoffPack(clientId: string, signoffId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("strategy_signoffs")
      .update({ status: "sent" })
      .eq("id", signoffId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/outputs`);
    return undefined;
  });
}

export async function deleteSignoffDraft(clientId: string, signoffId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("strategy_signoffs").delete().eq("id", signoffId).eq("status", "draft");
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/outputs`);
    return undefined;
  });
}

/** Portal-side: approve or request changes on a 'sent' pack. The
 * enforce_signoff_response trigger guarantees a client-role caller can only
 * change the response fields, whatever this code says. */
export async function respondToSignoff(
  signoffId: string,
  response: "approved" | "changes_requested",
  comments: string
): Promise<ActionResult> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  if (response === "changes_requested" && !comments.trim()) {
    return { ok: false, message: "Tell the team what you'd like changed." };
  }
  return runAction(async () => {
    const supabase = await createClient();
    const profile = await getCurrentProfile();

    const { error } = await supabase
      .from("strategy_signoffs")
      .update({
        status: response,
        client_comments: comments.trim(),
        approved_by_name: response === "approved" ? profile?.full_name || profile?.email || "Client" : "",
        approved_at: response === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", signoffId)
      .eq("status", "sent");
    if (error) throw new Error(error.message);
    revalidatePath("/portal/signoff");
    return undefined;
  });
}
