import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { PortalCard, ReadOnlyField } from "@/components/portal/ReadOnlyField";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Strategy" };

export default async function PortalStrategyPage() {
  const client = await getPortalClient();
  if (!client) return null; // layout already renders the not-linked state

  const supabase = await createClient();
  const [{ data: vision }, { data: positioning }, { data: pillars }, { data: audiences }, { data: socials }] =
    await Promise.all([
      supabase.from("brand_vision").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("positioning").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("brand_pillars").select("*").eq("client_id", client.id).order("sort_order").order("created_at"),
      supabase.from("audiences").select("*").eq("client_id", client.id).order("sort_order").order("created_at"),
      supabase.from("social_strategies").select("*").eq("client_id", client.id).order("sort_order").order("created_at"),
    ]);

  const hasAnything =
    Boolean(vision?.long_term_goal || positioning?.positioning_statement) ||
    (pillars?.length ?? 0) > 0 ||
    (audiences?.length ?? 0) > 0 ||
    (socials?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">The strategy behind your personal brand — kept up to date by the Aligned Media team.</p>

      {client.north_star.trim() && (
        <section className="rounded-lg border border-accent/40 bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">North Star</p>
          <p className="mt-1 whitespace-pre-wrap text-base font-medium text-ink">{client.north_star}</p>
        </section>
      )}

      {!hasAnything && (
        <EmptyState
          title="Your strategy is being built"
          description="As the team fills in your vision, positioning, pillars and platform plans, they'll appear here."
        />
      )}

      {vision && (
        <PortalCard title="Vision">
          <ReadOnlyField label="Long-term goal" value={vision.long_term_goal} />
          <ReadOnlyField label="Desired positioning" value={vision.desired_positioning} />
          <ReadOnlyField label="Authority goal" value={vision.authority_goal} />
          <ReadOnlyField label="Commercial goal" value={vision.commercial_goal} />
          <ReadOnlyField label="Impact goal" value={vision.impact_goal} />
          <ReadOnlyField label="Legacy / contribution" value={vision.legacy_contribution} />
        </PortalCard>
      )}

      {positioning && (
        <PortalCard title="Positioning">
          <ReadOnlyField label="Positioning statement" value={positioning.positioning_statement} />
          <ReadOnlyField label="Expertise" value={positioning.expertise} />
          <ReadOnlyField label="Differentiators" value={positioning.differentiators} />
          <ReadOnlyField label="Unique story" value={positioning.unique_story} />
          <ReadOnlyField label="Core beliefs" value={positioning.core_beliefs} />
        </PortalCard>
      )}

      {pillars && pillars.length > 0 && (
        <PortalCard title="Content pillars">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{pillar.name}</p>
              {pillar.description.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{pillar.description}</p>
              )}
            </div>
          ))}
        </PortalCard>
      )}

      {audiences && audiences.length > 0 && (
        <PortalCard title="Audiences">
          {audiences.map((audience) => (
            <div key={audience.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{audience.name}</p>
              {audience.description.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{audience.description}</p>
              )}
            </div>
          ))}
        </PortalCard>
      )}

      {socials && socials.length > 0 && (
        <PortalCard title="Platform strategy">
          {socials.map((social) => (
            <div key={social.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{social.platform}</p>
              <div className="mt-2 space-y-2">
                <ReadOnlyField label="Objective" value={social.objective} />
                <ReadOnlyField label="Content types" value={social.content_types} />
                <ReadOnlyField label="Posting frequency" value={social.posting_frequency} />
              </div>
            </div>
          ))}
        </PortalCard>
      )}
    </div>
  );
}
