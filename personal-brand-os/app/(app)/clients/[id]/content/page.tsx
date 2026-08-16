import { createClient } from "@/lib/supabase/server";
import { AddPillarButton } from "@/components/clients/AddPillarButton";
import { AddContentIdeaButton } from "@/components/clients/AddContentIdeaButton";
import { PillarCard } from "@/components/clients/PillarCard";
import { ContentIdeaRow } from "@/components/clients/ContentIdeaRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CONTENT_STATUS } from "@/lib/status";
import { getAllTeamMembers } from "@/lib/data/client";

export const metadata = { title: "Content" };

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pillars }, { data: ideas }, { data: audiences }, { data: outputs }, team] = await Promise.all([
    supabase.from("brand_pillars").select("*").eq("client_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("content_ideas").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("audiences").select("*").eq("client_id", id).order("sort_order", { ascending: true }),
    supabase.from("content_outputs").select("*").eq("client_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    getAllTeamMembers(supabase),
  ]);

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

  const teamOptions = team.map((m) => ({ id: m.id, name: m.name }));

  // Duane's §3: approved content must never disappear between production and
  // the Calendar — the queue is everything approved with an unscheduled
  // platform version, surfaced above the pipeline.
  const queue = ideaList.filter(
    (idea) =>
      idea.status === "ready_to_schedule" ||
      (idea.status === "scheduled" && (outputsByContent.get(idea.id) ?? []).some((o) => o.status === "pending"))
  );
  const queueIds = new Set(queue.map((i) => i.id));

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
      defaultOpen={defaultOpen}
    />
  );

  return (
    <div className="max-w-4xl space-y-8">
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
          <AddContentIdeaButton clientId={id} pillars={pillarList} audiences={audienceList} />
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
