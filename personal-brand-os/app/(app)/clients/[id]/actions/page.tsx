import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddActionButton } from "@/components/clients/AddActionButton";
import { ActionRow } from "@/components/clients/ActionRow";
import { ActionCard } from "@/components/clients/ActionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th } from "@/components/ui/Table";
import { getProfilesMap } from "@/lib/data/shared";
import { getOwnerOptions } from "@/lib/data/owners";

export const metadata = { title: "Actions" };

export default async function ClientActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: actions }, profiles, ownerOptions] = await Promise.all([
    supabase
      .from("actions")
      .select("*")
      .eq("client_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getProfilesMap(supabase),
    getOwnerOptions(supabase, id),
  ]);

  const open = (actions ?? []).filter((a) => a.status !== "completed");
  const done = (actions ?? []).filter((a) => a.status === "completed");
  const ordered = [...open, ...done];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">{open.length} open, {done.length} done</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${id}/actions/import`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            Import actions
          </Link>
          <AddActionButton clientId={id} ownerOptions={ownerOptions} />
        </div>
      </div>

      {ordered.length === 0 ? (
        <EmptyState title="No actions yet" description="Add the first action to start tracking follow-through for this client." />
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {ordered.map((action) => (
            <ActionCard
              key={action.id}
              clientId={id}
              action={action}
              ownerLabel={action.owner_user_id ? profiles.get(action.owner_user_id) : undefined}
              ownerOptions={ownerOptions}
            />
          ))}
        </div>
        <div className="hidden sm:block">
        <Table>
          <Thead>
            <tr>
              <Th>Title</Th>
              <Th>Owner</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {ordered.map((action) => (
              <ActionRow
                key={action.id}
                clientId={id}
                action={action}
                ownerLabel={action.owner_user_id ? profiles.get(action.owner_user_id) : undefined}
                ownerOptions={ownerOptions}
              />
            ))}
          </tbody>
        </Table>
        </div>
        </>
      )}
    </div>
  );
}
