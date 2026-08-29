import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddPillarButton } from "@/components/clients/AddPillarButton";
import { AddContentIdeaButton } from "@/components/clients/AddContentIdeaButton";
import { PillarCard } from "@/components/clients/PillarCard";
import { ContentIdeaRow } from "@/components/clients/ContentIdeaRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CONTENT_STATUS } from "@/lib/status";
import { getApproverOptions } from "@/lib/data/approvers";
import { socialAccountLabel } from "@/lib/format";
import { isAyrshareConfigured } from "@/lib/ayrshare";
import { CadenceStrip } from "@/components/clients/CadenceStrip";

export const metadata = { title: "Content" };

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pillars }, { data: ideas }, { data: audiences }, { data: outputs }, team, { data: auditRows }, { data: socialAccounts }] = await Promise.all([
    supabase.from("brand_pillars").select("*").eq("client_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("content_ideas").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("audiences").select("*").eq("client_id", id).order("sort_order", { ascending: true }),
    supabase.from("content_outputs").select("*").eq("client_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    getApproverOptions(supabase, id),
    supabase
      .from("audit_log")
      .select("record_id,changed_at,changed_by,summary")
      .eq("client_id", id)
      .in("table_name", ["content_ideas", "content_outputs"])
      .order("changed_at", { ascending: false })
      .limit(300),
    supabase
      .from("social_strategies")
      .select("*")
      .eq("client_id", id)
      .order("is_primary", { ascending: false })
      .order("sort_order"),
  ]);

  // Publishing accounts (Duane's multi-account structure): content selects
  // the actual account — "LinkedIn — Daniel Andrews" — not just a platform.
  const allAccounts = socialAccounts ?? [];
  const publishingAccounts = allAccounts
    .filter((account) => account.publishing_enabled && account.account_status !== "inactive")
    .map((account) => ({
      id: account.id,
      label: socialAccountLabel(account.platform, account.account_name),
    }));

  const pillarList = pillars ?? [];
  const ideaList = ideas ?? [];
  const audienceList = audiences ?? [];
  const outputList = outputs ?? [];
  const pillarNames = new Map(pillarList.map((p) => [p.id, p.name]));
  const outputsByContent = new Map<string, typeof outputList>();
  for (const output of outputList) {
    const list = outputsByContent.get(output.content_id) ?? [];
    list.push(output);
    outputsByContent.set(output.content_id, list);
  }
  const ideaCountByPillar = new Map<string, number>();
  for (const idea of ideaList) {
    if (idea.pillar_id) ideaCountByPillar.set(idea.pillar_id, (ideaCountByPillar.get(idea.pillar_id) ?? 0) + 1);
  }

  const teamOptions = team;
  const teamNames = new Map(team.map((m) => [m.id, m.name]));

  // Per-record history from the audit log (RLS: team-visible for content
  // tables only). An idea's history includes its platform versions'.
  const historyByRecord = new Map<string, { at: string; by: string; summary: string }[]>();
  for (const row of auditRows ?? []) {
    const list = historyByRecord.get(row.record_id) ?? [];
    list.push({
      at: row.changed_at,
      by: row.changed_by ? teamNames.get(row.changed_by) ?? "Someone" : "System / client",
      summary: row.summary,
    });
    historyByRecord.set(row.record_id, list);
  }
  const historyForIdea = (ideaId: string) => {
    const ids = [ideaId, ...(outputsByContent.get(ideaId) ?? []).map((o) => o.id)];
    return ids
      .flatMap((recordId) => historyByRecord.get(recordId) ?? [])
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 25);
  };

  // Duane's §3: approved content must never disappear between production and
  // the Calendar — the queue is everything approved with an unscheduled
  // platform version, surfaced above the pipeline.
  const queue = ideaList.filter(
    (idea) =>
      idea.status === "ready_to_schedule" ||
      (idea.status === "scheduled" && (outputsByContent.get(idea.id) ?? []).some((o) => o.status === "pending"))
  );
  const queueIds = new Set(queue.map((i) => i.id));

  // Planned-vs-target cadence (Duane's acceptance criterion 7). A version
  // counts towards this month when it's scheduled or published in it, or
  // when its master idea is targeted at it and it isn't dated yet.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const inThisMonth = (date: string | null) => Boolean(date) && date! >= monthStart && date! <= monthEnd;
  const ideaTargetDate = new Map(ideaList.map((idea) => [idea.id, idea.target_publish_date]));

  const plannedByAccount = new Map<string, number>();
  for (const output of outputList) {
    if (!output.social_account_id) continue;
    const dated = output.scheduled_at?.slice(0, 10) ?? output.published_at?.slice(0, 10) ?? null;
    const counts = dated ? inThisMonth(dated) : inThisMonth(ideaTargetDate.get(output.content_id) ?? null);
    if (counts) plannedByAccount.set(output.social_account_id, (plannedByAccount.get(output.social_account_id) ?? 0) + 1);
  }
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const groups = CONTENT_STATUS.map((status) => ({
    status,
    ideas: ideaList.filter((idea) => idea.status === status.value && !queueIds.has(idea.id)),
  })).filter((group) => group.ideas.length > 0);

  const renderIdea = (idea: (typeof ideaList)[number], defaultOpen = false) => (
    <ContentIdeaRow
      key={idea.id}
      clientId={id}
      idea={idea}
      outputs={outputsByContent.get(idea.id) ?? []}
      pillars={pillarList}
      audiences={audienceList}
      pillarName={idea.pillar_id ? pillarNames.get(idea.pillar_id) ?? null : null}
      team={teamOptions}
      accounts={publishingAccounts}
      history={historyForIdea(idea.id)}
      defaultOpen={defaultOpen}
      ayrshareEnabled={isAyrshareConfigured()}
    />
  );

  return (
    <div className="max-w-4xl space-y-8">
      <CadenceStrip clientId={id} accounts={allAccounts} planned={plannedByAccount} monthLabel={monthLabel} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Pillars</h2>
          <AddPillarButton clientId={id} />
        </div>
        {pillarList.length === 0 ? (
          <EmptyState title="No pillars yet" description="Pillars group content ideas by theme — add one to get started." />
        ) : (
          <div className="space-y-2">
            {pillarList.map((pillar, index) => (
              <PillarCard
                key={pillar.id}
                clientId={id}
                pillar={pillar}
                ideaCount={ideaCountByPillar.get(pillar.id) ?? 0}
                isFirst={index === 0}
                isLast={index === pillarList.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      {queue.length > 0 && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="mb-1 text-sm font-semibold text-ink">Ready to schedule · {queue.length}</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Approved and produced — expand a platform version and hit Schedule to put it on the Calendar.
          </p>
          <div className="space-y-2">{queue.map((idea) => renderIdea(idea, true))}</div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Content Pipeline</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${id}/content/import`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              Import content
            </Link>
            <AddContentIdeaButton clientId={id} pillars={pillarList} audiences={audienceList} />
          </div>
        </div>
        {ideaList.length === 0 ? (
          <EmptyState title="No content ideas yet" description="Add the first idea to start the pipeline." />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.status.value}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {group.status.label} · {group.ideas.length}
                </h3>
                <div className="space-y-2">{group.ideas.map((idea) => renderIdea(idea))}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
