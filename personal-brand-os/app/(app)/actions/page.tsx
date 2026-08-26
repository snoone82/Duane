import { createClient } from "@/lib/supabase/server";
import { getGlobalActions } from "@/lib/data/actions";
import { getProfilesMap } from "@/lib/data/shared";
import { getOwnerOptionsByClient } from "@/lib/data/owners";
import { ActionsToolbar } from "@/components/actions/ActionsToolbar";
import { ActionRow } from "@/components/clients/ActionRow";
import { ActionCard } from "@/components/clients/ActionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th } from "@/components/ui/Table";
import type { ActionStatus } from "@/lib/enums";
import type { DueFilter } from "@/lib/data/actions";

export const metadata = { title: "Actions" };

export default async function GlobalActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; due?: string; owner?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, profiles, ownerOptionsByClient, actions] = await Promise.all([
    supabase.from("clients").select("id,name").order("name", { ascending: true }),
    getProfilesMap(supabase),
    getOwnerOptionsByClient(supabase),
    getGlobalActions(supabase, {
      status: (params.status as ActionStatus | "all" | "not_done") || "not_done",
      clientId: params.client,
      owner: params.owner,
      due: (params.due as DueFilter) || "all",
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-ink">Actions</h1>
      <p className="mb-4 text-sm text-ink-soft">Every action across every client — this is the backlog, not a client-by-client tour.</p>

      <ActionsToolbar clients={clients ?? []} />

      {actions.length === 0 ? (
        <EmptyState title="Nothing matches" description="Try widening the filters — or there's genuinely nothing outstanding." />
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              clientId={action.client_id}
              action={action}
              clientName={action.clientName}
              ownerLabel={action.owner_user_id ? profiles.get(action.owner_user_id) : undefined}
              ownerOptions={ownerOptionsByClient.get(action.client_id) ?? ownerOptionsByClient.get("")}
            />
          ))}
        </div>
        <div className="hidden sm:block">
        <Table>
          <Thead>
            <tr>
              <Th>Client</Th>
              <Th>Title</Th>
              <Th>Owner</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                clientId={action.client_id}
                action={action}
                clientName={action.clientName}
                ownerLabel={action.owner_user_id ? profiles.get(action.owner_user_id) : undefined}
                ownerOptions={ownerOptionsByClient.get(action.client_id) ?? ownerOptionsByClient.get("")}
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
