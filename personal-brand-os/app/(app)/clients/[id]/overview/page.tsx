import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientById, getAssignedMembers, getAllTeamMembers, getClientActivity, getClientRoleProfiles } from "@/lib/data/client";
import { getOverviewSummary } from "@/lib/data/overview";
import { getCurrentProfile } from "@/lib/current-user";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamAssignments } from "@/components/clients/TeamAssignments";
import { PortalAccessControl } from "@/components/clients/PortalAccessControl";
import { NorthStarCard } from "@/components/clients/NorthStarCard";
import { ClientDangerZone } from "@/components/clients/ClientDangerZone";
import { ClientDetailsForms } from "@/components/clients/ClientDetailsForms";
import { formatDate, formatRelativeToToday, formatCurrency, formatDateTime, isOverdue, auditVerb } from "@/lib/format";
import { actionStatusMeta } from "@/lib/status";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const client = await getClientById(supabase, id);
  if (!client) notFound();

  const currentProfile = await getCurrentProfile();
  const isAdmin = currentProfile?.role === "admin";

  const [{ openActions, lastConsultation, nextMeeting }, assignedMembers, allMembers, activity, clientAccounts, { data: socialAccounts }] = await Promise.all([
    getOverviewSummary(supabase, id),
    getAssignedMembers(supabase, id),
    getAllTeamMembers(supabase),
    isAdmin ? getClientActivity(supabase, id) : Promise.resolve([]),
    isAdmin ? getClientRoleProfiles(supabase) : Promise.resolve([]),
    supabase
      .from("social_strategies")
      .select("id,platform,account_name,owner_brand,url,account_status,is_primary,show_on_overview")
      .eq("client_id", id)
      .eq("show_on_overview", true)
      .order("is_primary", { ascending: false })
      .order("sort_order"),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex justify-end">
        <Link
          href={`/clients/${id}/import`}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
        >
          Update via import
        </Link>
      </div>
      <NorthStarCard clientId={id} northStar={client.north_star} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <ClientDetailsForms client={client} />

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Social profiles</h2>
            <Link href={`/clients/${id}/social`} className="text-xs text-accent underline-offset-2 hover:underline">
              Manage on the Social tab →
            </Link>
          </div>
          {(socialAccounts ?? []).length === 0 ? (
            <p className="text-sm text-ink-faint">
              No social accounts marked &ldquo;Show on Overview&rdquo; yet — accounts are entered once, on the Social tab.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(socialAccounts ?? []).map((account) => (
                <li key={account.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-ink">
                    {account.url ? (
                      <a href={account.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                        {account.account_name ? `${account.platform} — ${account.account_name}` : account.platform}
                      </a>
                    ) : (
                      <>{account.account_name ? `${account.platform} — ${account.account_name}` : account.platform}</>
                    )}
                    {account.owner_brand && <span className="ml-2 text-xs text-ink-faint">{account.owner_brand}</span>}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-ink-faint">
                    {account.is_primary && <span className="rounded-full bg-surface-muted px-2 py-0.5">Primary</span>}
                    {account.account_status !== "active" && <span className="capitalize">{account.account_status}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Open actions</h2>
            <Link href={`/clients/${id}/actions`} className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          {openActions.length === 0 ? (
            <EmptyState title="No open actions" description="Nothing outstanding for this client right now." />
          ) : (
            <ul className="divide-y divide-border">
              {openActions.map((action) => {
                const meta = actionStatusMeta(action.status);
                return (
                  <li key={action.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-sm text-ink">{action.title}</span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {action.due_date && (
                        <span className={`text-xs ${isOverdue(action.due_date) ? "text-danger" : "text-ink-faint"}`}>
                          {isOverdue(action.due_date) ? "Overdue" : formatRelativeToToday(action.due_date)}
                        </span>
                      )}
                      <StatusPill label={meta.label} color={meta.color} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Key dates</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Client since</dt>
              <dd className="text-ink">{formatDate(client.created_at.slice(0, 10))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Last consultation</dt>
              <dd className="text-ink">{formatDate(lastConsultation)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Next meeting</dt>
              <dd className="text-ink">{nextMeeting ? formatRelativeToToday(nextMeeting) : "Not scheduled"}</dd>
            </div>
            {client.retainer_amount !== null && (
              <div className="flex justify-between">
                <dt className="text-ink-soft">Retainer</dt>
                <dd className="text-ink">{formatCurrency(client.retainer_amount)}/mo</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Assigned team members</h2>
          <TeamAssignments
            clientId={id}
            assigned={assignedMembers}
            allMembers={allMembers}
            isAdmin={isAdmin}
          />
        </section>

        {isAdmin && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Client portal</h2>
            <PortalAccessControl
              clientId={id}
              linkedUserId={client.portal_user_id}
              clientAccounts={clientAccounts}
              clientEmail={client.email}
            />
          </section>
        )}

        {isAdmin && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-faint">No changes logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((item) => (
                  <li key={item.id} className="text-xs">
                    <span className="text-ink">{item.changedByName} {auditVerb(item.action)} {item.tableName.replace(/_/g, " ")}</span>
                    <span className="block text-ink-faint">{formatDateTime(item.changedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Danger zone</h2>
            <ClientDangerZone clientId={id} clientName={client.name} />
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
