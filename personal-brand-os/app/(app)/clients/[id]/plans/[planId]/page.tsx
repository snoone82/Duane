import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientSnapshotPanel } from "@/components/clients/ClientSnapshotPanel";
import { ContentIdeaRow } from "@/components/clients/ContentIdeaRow";
import { AddPlanContentButton } from "@/components/clients/AddPlanContentButton";
import { RequirementRow } from "@/components/clients/RequirementRow";
import { AddRequirementButton } from "@/components/clients/AddRequirementButton";
import { AiBriefPanel } from "@/components/clients/AiBriefPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApproverOptions } from "@/lib/data/approvers";
import { socialAccountLabel } from "@/lib/format";
import { isAyrshareConfigured } from "@/lib/ayrshare";
import { periodMonthLabel } from "@/lib/monthly-plan-format";

export const metadata = { title: "Monthly Plan" };

export default async function MonthlyPlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  const supabase = await createClient();

  const [
    { data: plan },
    { data: pillars },
    { data: audiences },
    { data: ideas },
    { data: outputs },
    { data: requirements },
    team,
    { data: socialAccounts },
  ] = await Promise.all([
    supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", id).maybeSingle(),
    supabase.from("brand_pillars").select("*").eq("client_id", id).order("sort_order"),
    supabase.from("audiences").select("*").eq("client_id", id).order("sort_order"),
    supabase.from("content_ideas").select("*").eq("monthly_plan_id", planId).order("plan_sequence"),
    supabase.from("content_outputs").select("*").eq("client_id", id).order("sort_order").order("created_at"),
    supabase.from("monthly_plan_requirements").select("*").eq("monthly_plan_id", planId).order("created_at"),
    getApproverOptions(supabase, id),
    supabase.from("social_strategies").select("*").eq("client_id", id).order("is_primary", { ascending: false }).order("sort_order"),
  ]);

  if (!plan) notFound();

  const pillarList = pillars ?? [];
  const audienceList = audiences ?? [];
  const ideaList = ideas ?? [];
  const pillarNames = new Map(pillarList.map((p) => [p.id, p.name]));
  const outputsByContent = new Map<string, NonNullable<typeof outputs>>();
  for (const output of outputs ?? []) {
    if (!ideaList.some((idea) => idea.id === output.content_id)) continue;
    const list = outputsByContent.get(output.content_id) ?? [];
    list.push(output);
    outputsByContent.set(output.content_id, list);
  }

  const allAccounts = socialAccounts ?? [];
  const publishingAccounts = allAccounts
    .filter((account) => account.publishing_enabled && account.account_status !== "inactive")
    .map((account) => ({ id: account.id, label: socialAccountLabel(account.platform, account.account_name) }));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href={`/clients/${id}/plans`} className="text-xs text-accent underline-offset-2 hover:underline">
          ← All Monthly Plans
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-ink">{periodMonthLabel(plan.period_month)}</h1>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Client Snapshot</h2>
        <ClientSnapshotPanel clientId={id} plan={plan} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Master Content</h2>
          <AddPlanContentButton clientId={id} planId={planId} pillars={pillarList} audiences={audienceList} />
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          The unit of planning and approval. Platform Outputs — the unit of publishing — live nested inside each one below.
        </p>
        {ideaList.length === 0 ? (
          <EmptyState
            title="No Master Content yet"
            description="Add the first piece by hand, or generate an AI brief below and import Claude's proposed content."
          />
        ) : (
          <div className="space-y-2">
            {ideaList.map((idea) => (
              <ContentIdeaRow
                key={idea.id}
                clientId={id}
                idea={idea}
                outputs={outputsByContent.get(idea.id) ?? []}
                pillars={pillarList}
                audiences={audienceList}
                pillarName={idea.pillar_id ? pillarNames.get(idea.pillar_id) ?? null : null}
                team={team}
                accounts={publishingAccounts}
                ayrshareEnabled={isAyrshareConfigured()}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Requirements</h2>
          <AddRequirementButton clientId={id} planId={planId} />
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          Anything needed from the client or the team to fulfil this plan once it&rsquo;s approved.
        </p>
        {!requirements || requirements.length === 0 ? (
          <EmptyState title="No requirements yet" description="Add filming, assets, information or approvals this plan depends on." />
        ) : (
          <div className="space-y-2">
            {requirements.map((requirement) => (
              <RequirementRow key={requirement.id} clientId={id} requirement={requirement} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">AI export / import</h2>
        <p className="mb-3 text-xs text-ink-soft">
          PBOS owns this plan — Claude is only ever asked to propose structured content into it. No live API connection
          yet: generate a brief, paste it into Claude yourself, then paste the JSON it returns back in below.
        </p>
        <AiBriefPanel clientId={id} planId={planId} />
      </section>
    </div>
  );
}
