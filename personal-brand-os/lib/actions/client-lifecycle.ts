"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";

const EXPORT_TABLES = [
  "clients",
  "brand_vision",
  "positioning",
  "audiences",
  "brand_pillars",
  "content_ideas",
  "content_outputs",
  "authority_opportunities",
  "consultations",
  "actions",
  "metric_snapshots",
  "metric_targets",
  "scorecard_entries",
  "commercial_outcomes",
  "commercial_snapshots",
  "milestones",
  "client_files",
] as const;

/** §24 Security's "ability to export client data" — a full JSON dump of
 * every client-scoped table, gated by the same RLS every other read in the
 * app goes through (so an export can never surface more than the exporting
 * user could already see in the UI). */
export async function exportClientData(clientId: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const supabase = await createClient();
    const bundle: Record<string, unknown> = {};

    for (const table of EXPORT_TABLES) {
      const column = table === "clients" ? "id" : "client_id";
      // Genuinely dynamic multi-table loop — `table` is a union of every
      // exportable table name, so the typed client can't infer a `.eq()`
      // column type that's valid across all of them (it collapses to
      // `never`), unlike every other, single-table query in the app. The
      // `any` here is safe: `column` is always one of two hardcoded
      // literals, never user input, and `table` is drawn from the fixed
      // EXPORT_TABLES list above.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any).select("*").eq(column, clientId);
      if (error) throw new Error(error.message);
      bundle[table] = data;
    }

    return JSON.stringify(bundle, null, 2);
  });
}

/** §24 Security's "ability to delete client data when required" — RLS
 * restricts the delete itself to admins (clients_delete policy); every
 * other client-scoped table cascades via ON DELETE CASCADE in the schema. */
export async function deleteClient(clientId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) throw new Error(error.message);
    revalidatePath("/clients");
    return undefined;
  });
}

export async function deleteClientAndRedirect(clientId: string): Promise<void> {
  const result = await deleteClient(clientId);
  if (result.ok) redirect("/clients");
}
