import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientList, type ClientSort } from "@/lib/data/clients";
import type { ClientStatus } from "@/lib/enums";
import { ClientsToolbar } from "@/components/clients/ClientsToolbar";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/Table";
import { clientStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Clients" };

const COLUMNS: { key: ClientSort; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "package", label: "Package" },
  { key: "lastConsultation", label: "Last consultation" },
  { key: "openActions", label: "Open actions" },
];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const sort = (params.sort as ClientSort) || "name";
  const dir = params.dir === "desc" ? "desc" : "asc";

  const rows = await getClientList(supabase, {
    q: params.q,
    status: (params.status as ClientStatus | "all") || "all",
    sort,
    dir,
  });

  function sortHref(column: ClientSort) {
    const nextDir = sort === column && dir === "asc" ? "desc" : "asc";
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    search.set("sort", column);
    search.set("dir", nextDir);
    return `/clients?${search.toString()}`;
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Clients</h1>
      <p className="mb-4 text-sm text-ink-soft">{rows.length} client{rows.length === 1 ? "" : "s"}</p>

      <ClientsToolbar />

      {rows.length === 0 ? (
        <EmptyState
          title="No clients match"
          description="Try a different search or status filter, or add a new client to get started."
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              {COLUMNS.map((col) => (
                <Th key={col.key}>
                  <Link href={sortHref(col.key)} className="inline-flex items-center gap-1 hover:text-ink">
                    {col.label}
                    {sort === col.key && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
                  </Link>
                </Th>
              ))}
            </tr>
          </Thead>
          <tbody>
            {rows.map((client) => {
              const meta = clientStatusMeta(client.status);
              const href = `/clients/${client.id}/overview`;
              return (
                <Tr key={client.id} className="hover:bg-surface-muted">
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2 font-medium text-ink">
                      {client.name}
                    </Link>
                  </Td>
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2 text-ink-soft">
                      {client.company || "—"}
                    </Link>
                  </Td>
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2">
                      <StatusPill label={meta.label} color={meta.color} />
                    </Link>
                  </Td>
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2 text-ink-soft">
                      {client.package || "—"}
                    </Link>
                  </Td>
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2 text-ink-soft">
                      {formatDate(client.lastConsultation)}
                    </Link>
                  </Td>
                  <Td className="p-0">
                    <Link href={href} className="block px-3 py-2 text-ink-soft">
                      {client.openActions}
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
