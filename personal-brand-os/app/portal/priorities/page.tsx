import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { PortalActionCard } from "@/components/portal/PortalActionCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Actions" };

/** Duane Part I + his portal feedback: three clearly-separated groups —
 * My Actions (assigned to the signed-in person), Client Actions (the
 * client team's), and Aligned Media Actions (what the agency is working
 * on, read-only). Updates land on the same Action records the dashboard
 * shows — there is no separate client copy. */
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
  const memberNameSet = new Set((teamMembers ?? []).map((m) => m.name.trim().toLowerCase()));
  const ownerLabel = (action: { owner_user_id: string | null; owner_name: string | null }) => {
    if (action.owner_user_id === context.userId) return "Assigned to you";
    if (action.owner_user_id) return memberNames.get(action.owner_user_id) ?? "Aligned Media team";
    return action.owner_name ?? "Aligned Media team";
  };
  const isClientSide = (a: { owner_user_id: string | null; owner_name: string | null }) =>
    (a.owner_user_id !== null && memberNames.has(a.owner_user_id)) ||
    (a.owner_user_id === null && a.owner_name !== null && memberNameSet.has(a.owner_name.trim().toLowerCase()));

  const all = actions ?? [];
  const mine = all.filter((a) => a.owner_user_id === context.userId);
  const clientTeam = all.filter((a) => a.owner_user_id !== context.userId && isClientSide(a));
  const alignedMedia = all.filter((a) => a.owner_user_id !== context.userId && !isClientSide(a));
  const canManageOthers = context.can("manage_actions");

  const split = (list: typeof all, doneCap: number) => [
    ...list.filter((a) => a.status !== "completed"),
    ...list.filter((a) => a.status === "completed").slice(0, doneCap),
  ];

  const groups: { title: string; note?: string; items: typeof all; canManage: boolean }[] = [
    { title: "My actions", items: split(mine, 5), canManage: true },
    { title: "Client actions", note: "Tasks with you and your team.", items: split(clientTeam, 5), canManage: canManageOthers },
    {
      title: "Aligned Media actions",
      note: "What the team is working on for you right now.",
      items: split(alignedMedia, 10),
      canManage: false,
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-ink-soft">
        The work being done for {context.client.name} — updates you make here go straight to the Aligned Media team.
      </p>

      {all.length === 0 && (
        <EmptyState title="No actions yet" description="Tasks agreed with the team will show up here." />
      )}

      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.title}>
              <h2 className="text-sm font-semibold text-ink">{group.title}</h2>
              {group.note && <p className="mb-2 mt-0.5 text-xs text-ink-faint">{group.note}</p>}
              <div className={`space-y-2 ${group.note ? "" : "mt-2"}`}>
                {group.items.map((action) => (
                  <PortalActionCard
                    key={action.id}
                    action={action}
                    ownerLabel={ownerLabel(action)}
                    canManage={group.canManage}
                    contentHref={action.content_id ? `/portal/content#idea-${action.content_id}` : null}
                  />
                ))}
              </div>
            </section>
          )
      )}
    </div>
  );
}
