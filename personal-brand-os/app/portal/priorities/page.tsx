import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { PortalActionCard } from "@/components/portal/PortalActionCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Actions" };

/** Duane Part I: the client team's task view. "My Actions" = assigned to
 * this signed-in person; "Client actions" = the other client-visible tasks
 * their permissions let them see. Updates land on the same Action records
 * the Aligned Media dashboard shows — there is no separate client copy. */
export default async function PortalActionsPage() {
  const context = await getPortalContext();
  if (!context) return null;

  const supabase = await createClient();
  // RLS already scopes this to what this account may see (own actions +
  // client-visible ones when permitted) — no extra filtering needed here.
  const [{ data: actions }, { data: teamMembers }] = await Promise.all([
    supabase
      .from("actions")
      .select("*")
      .eq("client_id", context.client.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.from("client_members").select("user_id,name").eq("client_id", context.client.id),
  ]);

  const memberNames = new Map((teamMembers ?? []).filter((m) => m.user_id).map((m) => [m.user_id as string, m.name]));
  const ownerLabel = (action: { owner_user_id: string | null; owner_name: string | null }) => {
    if (action.owner_user_id === context.userId) return "Assigned to you";
    if (action.owner_user_id) return memberNames.get(action.owner_user_id) ?? "Aligned Media team";
    return action.owner_name ?? "Aligned Media team";
  };

  const all = actions ?? [];
  const mine = all.filter((a) => a.owner_user_id === context.userId);
  const others = all.filter((a) => a.owner_user_id !== context.userId);
  const canManageOthers = context.can("manage_actions");

  const openMine = mine.filter((a) => a.status !== "completed");
  const doneMine = mine.filter((a) => a.status === "completed").slice(0, 5);
  const openOthers = others.filter((a) => a.status !== "completed");
  const doneOthers = others.filter((a) => a.status === "completed").slice(0, 10);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">
        The work being done for {context.client.name} — updates you make here go straight to the Aligned Media team.
      </p>

      {all.length === 0 && (
        <EmptyState title="No actions yet" description="Tasks agreed with the team will show up here." />
      )}

      {(openMine.length > 0 || doneMine.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">My actions</h2>
          <div className="space-y-2">
            {openMine.map((action) => (
              <PortalActionCard key={action.id} action={action} ownerLabel={ownerLabel(action)} canManage />
            ))}
            {openMine.length === 0 && <p className="text-sm text-ink-faint">Nothing assigned to you right now.</p>}
            {doneMine.map((action) => (
              <PortalActionCard key={action.id} action={action} ownerLabel={ownerLabel(action)} canManage />
            ))}
          </div>
        </section>
      )}

      {(openOthers.length > 0 || doneOthers.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Client actions</h2>
          <div className="space-y-2">
            {openOthers.map((action) => (
              <PortalActionCard key={action.id} action={action} ownerLabel={ownerLabel(action)} canManage={canManageOthers} />
            ))}
            {doneOthers.map((action) => (
              <PortalActionCard key={action.id} action={action} ownerLabel={ownerLabel(action)} canManage={canManageOthers} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
