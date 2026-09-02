import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/data/portal";
import { ReadOnlyField } from "@/components/portal/ReadOnlyField";
import { EmptyState } from "@/components/ui/EmptyState";
import { socialAccountLabel } from "@/lib/format";

export const metadata = { title: "Strategy" };

/** Duane's progressive-disclosure ask: the North Star stays permanently
 * visible; every other section is a collapsed card showing a one-line
 * summary until the client expands it. Nothing removed — just easier to
 * consume than one long document. */
function StrategySection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {summary && <span className="mt-0.5 block truncate text-xs text-ink-faint">{summary}</span>}
        </span>
        <span aria-hidden className="flex-shrink-0 text-ink-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

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

  const clip = (value: string | null | undefined, length = 90) => {
    const text = (value ?? "").trim().replace(/\s+/g, " ");
    return text.length > length ? `${text.slice(0, length)}…` : text;
  };

  const hasAnything =
    Boolean(vision?.long_term_goal || positioning?.positioning_statement) ||
    (pillars?.length ?? 0) > 0 ||
    (audiences?.length ?? 0) > 0 ||
    (socials?.length ?? 0) > 0;

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-ink-soft">
        The strategy behind your personal brand — kept up to date by the Aligned Media team. Tap a section to open it.
      </p>

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

      {vision && (vision.long_term_goal || vision.desired_positioning || vision.commercial_goal) && (
        <StrategySection title="Vision & Goals" summary={clip(vision.long_term_goal)}>
          <ReadOnlyField label="Long-term goal" value={vision.long_term_goal} />
          <ReadOnlyField label="Desired positioning" value={vision.desired_positioning} />
          <ReadOnlyField label="Authority goal" value={vision.authority_goal} />
          <ReadOnlyField label="Commercial goal" value={vision.commercial_goal} />
          <ReadOnlyField label="Impact goal" value={vision.impact_goal} />
          <ReadOnlyField label="Legacy / contribution" value={vision.legacy_contribution} />
        </StrategySection>
      )}

      {positioning && (positioning.positioning_statement || positioning.expertise) && (
        <StrategySection title="Positioning" summary={clip(positioning.positioning_statement)}>
          <ReadOnlyField label="Positioning statement" value={positioning.positioning_statement} />
          <ReadOnlyField label="Expertise" value={positioning.expertise} />
          <ReadOnlyField label="Differentiators" value={positioning.differentiators} />
          <ReadOnlyField label="Unique story" value={positioning.unique_story} />
          <ReadOnlyField label="Core beliefs" value={positioning.core_beliefs} />
        </StrategySection>
      )}

      {audiences && audiences.length > 0 && (
        <StrategySection title="Audiences" summary={audiences.map((a) => a.name).join(" · ")}>
          {audiences.map((audience) => (
            <div key={audience.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{audience.name}</p>
              {audience.description.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{audience.description}</p>
              )}
            </div>
          ))}
        </StrategySection>
      )}

      {pillars && pillars.length > 0 && (
        <StrategySection title="Content Pillars" summary={pillars.map((p) => p.name).join(" · ")}>
          {pillars.map((pillar) => (
            <div key={pillar.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{pillar.name}</p>
              {pillar.description.trim() && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{pillar.description}</p>
              )}
            </div>
          ))}
        </StrategySection>
      )}

      {socials && socials.length > 0 && (
        <StrategySection
          title="Platform Strategy"
          summary={socials.map((s) => socialAccountLabel(s.platform, s.account_name)).join(" · ")}
        >
          {socials.map((social) => (
            <div key={social.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{socialAccountLabel(social.platform, social.account_name)}</p>
              <div className="mt-2 space-y-2">
                <ReadOnlyField label="Objective" value={social.objective} />
                <ReadOnlyField label="Content types" value={social.content_types} />
                <ReadOnlyField label="Posting frequency" value={social.posting_frequency} />
              </div>
            </div>
          ))}
        </StrategySection>
      )}
    </div>
  );
}
