import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { AddSocialStrategyButton } from "@/components/clients/AddSocialStrategyButton";
import { SocialStrategyCard } from "@/components/clients/SocialStrategyCard";
import { AyrshareConnections } from "@/components/clients/AyrshareConnections";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAyrshareConfigured } from "@/lib/ayrshare";

export const metadata = { title: "Social strategy" };

export default async function SocialStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const ayrshareEnabled = isAyrshareConfigured();

  const [{ data: strategies }, { data: connections }, currentProfile] = await Promise.all([
    supabase
      .from("social_strategies")
      .select("*")
      .eq("client_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    ayrshareEnabled
      ? supabase.from("ayrshare_profiles").select("id,title").eq("client_id", id).order("created_at")
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    getCurrentProfile(),
  ]);

  const connectionProfiles = connections ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">How this brand shows up on each platform.</p>
        <AddSocialStrategyButton clientId={id} />
      </div>

      {ayrshareEnabled && (
        <AyrshareConnections clientId={id} profiles={connectionProfiles} isAdmin={currentProfile?.role === "admin"} />
      )}

      {!strategies || strategies.length === 0 ? (
        <EmptyState
          title="No platform strategies yet"
          description="Add each platform this client is active on — every one expands to capture the objective, audience, content types, cadence and growth plan."
        />
      ) : (
        <div className="space-y-2">
          {strategies.map((strategy) => (
            <SocialStrategyCard
              key={strategy.id}
              clientId={id}
              strategy={strategy}
              ayrshareEnabled={ayrshareEnabled}
              connectionProfiles={connectionProfiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}
