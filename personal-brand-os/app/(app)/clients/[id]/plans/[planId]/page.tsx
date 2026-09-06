import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClientSnapshotPanel } from "@/components/clients/ClientSnapshotPanel";
import { ContentIdeaRow } from "@/components/clients/ContentIdeaRow";
import { AddPlanContentButton } from "@/components/clients/AddPlanContentButton";
import { RequirementRow } from "@/components/clients/RequirementRow";
import { AddRequirementButton } from "@/components/clients/AddRequirementButton";
import { RecomputeRequirementsButton } from "@/components/clients/RecomputeRequirementsButton";
import { AssignPublishDatesButton } from "@/components/clients/AssignPublishDatesButton";
import { AiBriefPanel } from "@/components/clients/AiBriefPanel";
import { ExportPlanJsonButton } from "@/components/clients/ExportPlanJsonButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { getApproverOptions } from "@/lib/data/approvers";
import { socialAccountLabel } from "@/lib/format";
import { isAyrshareConfigured } from "@/lib/ayrshare";
import { periodMonthLabel, isPlatformExcluded } from "@/lib/monthly-plan-format";
import { checkMonthlyPlanReadiness } from "@/lib/actions/monthly-plans";
import { ChangeRequestList, changeRequestIdeaLabel } from "@/components/clients/ChangeRequestPanel";
import { isPlanLocked } from "@/lib/monthly-plan-format";

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
    readinessResult,
    { data: changeRequests },
  ] = await Promise.all([
    supabase.from("monthly_plans").select("*").eq("id", planId).eq("client_id", id).maybeSingle(),
    supabase.from("brand_pillars").select("*").eq("client_id", id).order("sort_order"),
    supabase.from("audiences").select("*").eq("client_id", id).order("sort_order"),
    supabase.from("content_ideas").select("*").eq("monthly_plan_id", planId).order("plan_sequence"),
    supabase.from("content_outputs").select("*").eq("client_id", id).order("sort_order").order("created_at"),
    supabase.from("monthly_plan_requirements").select("*").eq("monthly_plan_id", planId).order("created_at"),
    getApproverOptions(supabase, id),
    supabase.from("social_strategies").select("*").eq("client_id", id).order("is_primary", { ascending: false }).order("sort_order"),
    checkMonthlyPlanReadiness(id),
    supabase.from("master_content_change_requests").select("*").eq("monthly_plan_id", planId).order("created_at", { ascending: false }),
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
  // Excludes accounts this Monthly Plan can't use (Duane: never offered as a
  // destination) — the same rule exportAiBrief/importAiOutput enforce.
  const publishingAccounts = allAccounts
    .filter((account) => !isPlatformExcluded(account))
    .map((account) => ({ id: account.id, label: socialAccountLabel(account.platform, account.account_name) }));

  const planLocked = isPlanLocked(plan.status);
  const requestList = changeRequests ?? [];
  const openRequests = requestList.filter((r) => r.state === "open").length;
  const ideaLabels = new Map(ideaList.map((idea) => [idea.id, changeRequestIdeaLabel(idea.plan_sequence, idea.title)]));

  const readiness = readinessResult.ok
    ? readinessResult.data
    : { ready: false, blockers: [readinessResult.message], platforms: [] };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href={`/clients/${id}/plans`} className="text-xs text-accent underline-offset-2 hover:underline">
          ← All Monthly Plans
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-ink">{periodMonthLabel(plan.period_month)}</h1>
          {plan.revision > 1 && (
            <span title="Earlier versions of this plan were saved as revisions when their approved content was replaced.">
              <StatusPill label={`Revision ${plan.revision}`} color="slate" />
            </span>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Client Snapshot</h2>
        <ClientSnapshotPanel clientId={id} plan={plan} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Master Content</h2>
          <div className="flex items-center gap-2">
            <AssignPublishDatesButton clientId={id} planId={planId} />
            <AddPlanContentButton clientId={id} planId={planId} pillars={pillarList} audiences={audienceList} accounts={publishingAccounts} />
          </div>
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          The unit of planning and approval. Platform Outputs — the unit of publishing — live nested inside each one below.
          {planLocked
            ? " This plan is approved: its Master Content is locked as the approved version for the month. Changes go through change requests below."
            : " Edit fields inline, or regenerate one item on its own — the whole month only needs regenerating if the editorial direction is wrong."}
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
                planId={planId}
                planLocked={planLocked}
              />
            ))}
          </div>
        )}
      </section>

      {(planLocked || requestList.length > 0) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Change requests{openRequests > 0 ? ` (${openRequests} open)` : ""}
          </h2>
          <p className="mb-3 text-xs text-ink-soft">
            Once the client has approved the plan, a change to one Master Content item is raised here — one item, one
            change, reviewed — and the approved version stays exactly as approved until it&rsquo;s applied. Most client
            amendments should never need the whole month regenerating.
          </p>
          {requestList.length === 0 ? (
            <EmptyState title="No change requests" description="Use “Request change…” or “Propose regeneration…” on a Master Content item above." />
          ) : (
            <ChangeRequestList clientId={id} requests={requestList} ideaLabels={ideaLabels} />
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Requirements</h2>
          <div className="flex items-center gap-2">
            <RecomputeRequirementsButton clientId={id} planId={planId} />
            <AddRequirementButton clientId={id} planId={planId} />
          </div>
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          Anything needed from the client or the team to fulfil this plan once it&rsquo;s approved. Production requirements
          (filming, assets) are computed from the Platform Outputs actually planned below — recompute after adding or
          changing them by hand.
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
        <h2 className="mb-3 text-sm font-semibold text-ink">Structured export</h2>
        <p className="mb-3 text-xs text-ink-soft">
          The Monthly Plan as one JSON document — Client Snapshot, Master Content, Platform Outputs and Requirements. The
          first PBOS output is this structured data; the client-facing pack is prototyped from it manually, for now.
        </p>
        <ExportPlanJsonButton clientId={id} planId={planId} periodLabel={periodMonthLabel(plan.period_month)} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">AI export / import</h2>
        <p className="mb-3 text-xs text-ink-soft">
          PBOS owns this plan — Claude is only ever asked to propose structured content into it. No live API connection
          yet: generate a brief, paste it into Claude yourself, then paste the JSON it returns back in below.
        </p>
        <AiBriefPanel clientId={id} planId={planId} periodMonth={plan.period_month} readiness={readiness} />
      </section>
    </div>
  );
}
