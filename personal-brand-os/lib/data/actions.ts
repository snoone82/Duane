import type { Database } from "@/lib/database.types";
import type { ActionStatus } from "@/lib/enums";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getClientsMap, getProfilesMap } from "@/lib/data/shared";

type Client = SupabaseServerClient;
type ActionRow = Database["public"]["Tables"]["actions"]["Row"];

export type DueFilter = "all" | "overdue" | "this_week" | "no_date";

export interface GlobalActionRow extends ActionRow {
  clientName: string;
}

export async function getGlobalActions(
  supabase: Client,
  opts: { status?: ActionStatus | "all" | "not_done"; clientId?: string; owner?: string; due?: DueFilter }
): Promise<GlobalActionRow[]> {
  let query = supabase.from("actions").select("*");

  if (opts.status === "not_done") query = query.neq("status", "completed");
  else if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);

  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7ISO = in7Days.toISOString().slice(0, 10);

  if (opts.due === "overdue") query = query.lt("due_date", today);
  if (opts.due === "this_week") query = query.gte("due_date", today).lte("due_date", in7ISO);
  if (opts.due === "no_date") query = query.is("due_date", null);

  query = query.order("due_date", { ascending: true, nullsFirst: false });

  const [{ data: actions }, clients, profiles] = await Promise.all([
    query,
    getClientsMap(supabase),
    getProfilesMap(supabase),
  ]);

  let rows: GlobalActionRow[] = (actions ?? []).map((action) => ({
    ...action,
    clientName: clients.get(action.client_id) ?? "Unknown client",
  }));

  if (opts.owner) {
    const needle = opts.owner.toLowerCase();
    rows = rows.filter((action) => {
      const ownerText = action.owner_user_id ? (profiles.get(action.owner_user_id) ?? "") : (action.owner_name ?? "");
      return ownerText.toLowerCase().includes(needle);
    });
  }

  return rows;
}
