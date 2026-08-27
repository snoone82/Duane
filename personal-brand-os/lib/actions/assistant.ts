"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";

/** Persist one question-and-answer pair once the stream has finished, so a
 * conversation survives moving between tabs, reloading, or coming back
 * tomorrow. Threads are per user per client (RLS). */
export async function saveAssistantExchange(
  clientId: string,
  question: string,
  answer: string
): Promise<ActionResult> {
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return { ok: false, message: "Nothing to save." };

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const { error } = await supabase.from("assistant_messages").insert([
      { client_id: clientId, user_id: user.id, role: "user", content: q },
      { client_id: clientId, user_id: user.id, role: "assistant", content: a },
    ]);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/assistant`);
    return undefined;
  });
}

/** Start again — clears only your own thread for this client. */
export async function clearAssistantThread(clientId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in.");

    const { error } = await supabase
      .from("assistant_messages")
      .delete()
      .eq("client_id", clientId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/assistant`);
    return undefined;
  });
}
