import type { ClientStatus } from "@/lib/enums";
import type { SupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseServerClient;

export interface ClientListRow {
  id: string;
  name: string;
  company: string | null;
  status: ClientStatus;
  package: string | null;
  lastConsultation: string | null;
  openActions: number;
}

export type ClientSort = "name" | "company" | "status" | "package" | "lastConsultation" | "openActions";

export async function getClientList(
  supabase: Client,
  opts: { q?: string; status?: ClientStatus | "all"; sort?: ClientSort; dir?: "asc" | "desc" }
): Promise<ClientListRow[]> {
  let query = supabase.from("clients").select("id,name,company,status,package");

  if (opts.q) query = query.ilike("name", `%${opts.q}%`);
  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);

  // Direct columns sort in SQL; computed columns (below) sort in JS after.
  const directSortable: ClientSort[] = ["name", "company", "status", "package"];
  if (opts.sort && directSortable.includes(opts.sort)) {
    query = query.order(opts.sort, { ascending: opts.dir !== "desc" });
  } else {
    query = query.order("name", { ascending: true });
  }

  const { data: clients } = await query;
  const clientIds = (clients ?? []).map((c) => c.id);

  const [{ data: consultations }, { data: actions }] = await Promise.all([
    clientIds.length
      ? supabase.from("consultations").select("client_id,meeting_date").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string; meeting_date: string }[] }),
    clientIds.length
      ? supabase.from("actions").select("client_id,status").in("client_id", clientIds).neq("status", "completed")
      : Promise.resolve({ data: [] as { client_id: string; status: string }[] }),
  ]);

  const lastConsultation = new Map<string, string>();
  for (const row of consultations ?? []) {
    const current = lastConsultation.get(row.client_id);
    if (!current || row.meeting_date > current) lastConsultation.set(row.client_id, row.meeting_date);
  }

  const openActionCounts = new Map<string, number>();
  for (const row of actions ?? []) {
    openActionCounts.set(row.client_id, (openActionCounts.get(row.client_id) ?? 0) + 1);
  }

  let rows: ClientListRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    status: c.status,
    package: c.package,
    lastConsultation: lastConsultation.get(c.id) ?? null,
    openActions: openActionCounts.get(c.id) ?? 0,
  }));

  if (opts.sort === "lastConsultation") {
    rows = rows.sort((a, b) => (a.lastConsultation ?? "").localeCompare(b.lastConsultation ?? ""));
    if (opts.dir === "desc") rows.reverse();
  } else if (opts.sort === "openActions") {
    rows = rows.sort((a, b) => a.openActions - b.openActions);
    if (opts.dir === "desc") rows.reverse();
  }

  return rows;
}
