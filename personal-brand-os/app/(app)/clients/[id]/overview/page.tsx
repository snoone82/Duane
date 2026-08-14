import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientById, getAssignedMembers, getAllTeamMembers, getClientActivity } from "@/lib/data/client";
import { getOverviewSummary } from "@/lib/data/overview";
import { getCurrentProfile } from "@/lib/current-user";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamAssignments } from "@/components/clients/TeamAssignments";
import { ClientDangerZone } from "@/components/clients/ClientDangerZone";
import { updateClientField } from "@/lib/actions/clients";
import { formatDate, formatRelativeToToday, formatCurrency, formatDateTime, isOverdue } from "@/lib/format";
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

  const [{ openActions, lastConsultation, nextMeeting }, assignedMembers, allMembers, activity] = await Promise.all([
    getOverviewSummary(supabase, id),
    getAssignedMembers(supabase, id),
    getAllTeamMembers(supabase),
    isAdmin ? getClientActivity(supabase, id) : Promise.resolve([]),
  ]);

  const save = (
    field: "email" | "phone" | "package" | "job_title" | "company" | "industry" | "location" | "retainer_amount" | "linkedin_url" | "website_url" | "twitter_url" | "instagram_url" | "youtube_url" | "tiktok_url"
  ) => (value: string) => updateClientField(id, field, value);

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Contact details</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AutosaveInput id="job_title" label="Job title" initialValue={client.job_title ?? ""} onSave={save("job_title")} />
            <AutosaveInput id="company" label="Company" initialValue={client.company ?? ""} onSave={save("company")} />
            <AutosaveInput id="industry" label="Industry" initialValue={client.industry ?? ""} onSave={save("industry")} />
            <AutosaveInput id="location" label="Location" initialValue={client.location ?? ""} onSave={save("location")} />
            <AutosaveInput id="package" label="Package" initialValue={client.package ?? ""} onSave={save("package")} />
            <AutosaveInput id="retainer_amount" label="Retainer ($/month)" type="number" initialValue={client.retainer_amount?.toString() ?? ""} onSave={save("retainer_amount")} />
            <AutosaveInput id="email" label="Email" type="email" initialValue={client.email ?? ""} onSave={save("email")} />
            <AutosaveInput id="phone" label="Phone" type="tel" initialValue={client.phone ?? ""} onSave={save("phone")} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Social profiles</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AutosaveInput id="linkedin_url" label="LinkedIn URL" initialValue={client.linkedin_url ?? ""} onSave={save("linkedin_url")} />
            <AutosaveInput id="website_url" label="Website URL" initialValue={client.website_url ?? ""} onSave={save("website_url")} />
            <AutosaveInput id="twitter_url" label="X / Twitter URL" initialValue={client.twitter_url ?? ""} onSave={save("twitter_url")} />
            <AutosaveInput id="instagram_url" label="Instagram URL" initialValue={client.instagram_url ?? ""} onSave={save("instagram_url")} />
            <AutosaveInput id="youtube_url" label="YouTube URL" initialValue={client.youtube_url ?? ""} onSave={save("youtube_url")} />
            <AutosaveInput id="tiktok_url" label="TikTok URL" initialValue={client.tiktok_url ?? ""} onSave={save("tiktok_url")} />
          </div>
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
            <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-faint">No changes logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((item) => (
                  <li key={item.id} className="text-xs">
                    <span className="text-ink">{item.changedByName} {item.action}d {item.tableName.replace(/_/g, " ")}</span>
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
  );
}
