import { createClient } from "@/lib/supabase/server";
import { AddPillarButton } from "@/components/clients/AddPillarButton";
import { AddContentIdeaButton } from "@/components/clients/AddContentIdeaButton";
import { PillarCard } from "@/components/clients/PillarCard";
import { ContentIdeaRow } from "@/components/clients/ContentIdeaRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CONTENT_STATUS } from "@/lib/status";

export const metadata = { title: "Content" };

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pillars }, { data: ideas }, { data: audiences }] = await Promise.all([
    supabase.from("brand_pillars").select("*").eq("client_id", id).order("sort_order", { ascending: true }),
    supabase.from("content_ideas").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("audiences").select("*").eq("client_id", id).order("sort_order", { ascending: true }),
  ]);

  const pillarList = pillars ?? [];
  const ideaList = ideas ?? [];
  const audienceList = audiences ?? [];
  const pillarNames = new Map(pillarList.map((p) => [p.id, p.name]));
  const ideaCountByPillar = new Map<string, number>();
  for (const idea of ideaList) {
    if (idea.pillar_id) ideaCountByPillar.set(idea.pillar_id, (ideaCountByPillar.get(idea.pillar_id) ?? 0) + 1);
  }

  const groups = CONTENT_STATUS.map((status) => ({
    status,
    ideas: ideaList.filter((idea) => idea.status === status.value),
  })).filter((group) => group.ideas.length > 0);

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
            {pillarList.map((pillar) => (
              <PillarCard key={pillar.id} clientId={id} pillar={pillar} ideaCount={ideaCountByPillar.get(pillar.id) ?? 0} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Ideas</h2>
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
                <div className="space-y-2">
                  {group.ideas.map((idea) => (
                    <ContentIdeaRow
                      key={idea.id}
                      clientId={id}
                      idea={idea}
                      pillars={pillarList}
                      audiences={audienceList}
                      pillarName={idea.pillar_id ? pillarNames.get(idea.pillar_id) ?? null : null}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
