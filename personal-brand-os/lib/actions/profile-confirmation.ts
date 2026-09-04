import { revalidatePath } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

/** Must match lib/import/client-profile.ts's CONFIRM_TITLE exactly — the
 * importer and this module manage the same Action. */
const CONFIRM_TITLE = "Confirm outstanding profile details with client";

/**
 * Duane's "operational reflection" principle applied to the Outstanding
 * Profile checklist (3 Sep 2026): the importer already ticks a matching
 * item when a re-import supplies a value (lib/actions/import.ts, Part H
 * §14) — this does the same thing for a field typed straight into the
 * client's profile, so a missing field getting filled in disappears from
 * the follow-up whichever way it happened.
 *
 * Labels are the exact strings the importer produces (`"<Section> →
 * <field>"`) so both paths tick the same checklist — see the individual
 * callers in lib/actions/clients.ts, vision.ts, positioning.ts, sales.ts
 * for how each field maps to its label.
 *
 * One-way, like the importer's own version: clearing a field afterwards
 * never un-ticks the item — a checkbox that flips back to unconfirmed the
 * moment someone pauses mid-edit would be more confusing than useful, and
 * "was this ever confirmed" is the question the follow-up action is
 * actually answering.
 */
export async function resolveOutstandingProfileLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  labels: string[]
): Promise<void> {
  if (labels.length === 0) return;

  const { data: action } = await supabase
    .from("actions")
    .select("id,checklist")
    .eq("client_id", clientId)
    .eq("title", CONFIRM_TITLE)
    .neq("status", "completed")
    .maybeSingle();
  if (!action) return;

  const current = Array.isArray(action.checklist)
    ? (action.checklist as { text: string; done: boolean }[]).map((c) => ({ text: String(c.text ?? ""), done: c.done === true }))
    : [];
  if (current.length === 0) return;

  const wanted = new Set(labels);
  let ticked = 0;
  const next = current.map((item) => {
    if (!item.done && wanted.has(item.text)) {
      ticked += 1;
      return { ...item, done: true };
    }
    return item;
  });
  if (ticked === 0) return;

  const allDone = next.every((c) => c.done);
  const patch: Database["public"]["Tables"]["actions"]["Update"] = { checklist: next };
  if (allDone) {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  }
  await supabase.from("actions").update(patch).eq("id", action.id);
  revalidatePath(`/clients/${clientId}/actions`);
  revalidatePath(`/clients/${clientId}/overview`);
}
