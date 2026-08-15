import { createClient } from "@/lib/supabase/server";
import { AddSocialStrategyButton } from "@/components/clients/AddSocialStrategyButton";
import { SocialStrategyCard } from "@/components/clients/SocialStrategyCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Social strategy" };

export default async function SocialStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: strategies } = await supabase
    .from("social_strategies")
    .select("*")
    .eq("client_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">How this brand shows up on each platform.</p>
        <AddSocialStrategyButton clientId={id} />
      </div>

      {!strategies || strategies.length === 0 ? (
        <EmptyState
          title="No platform strategies yet"
          description="Add each platform this client is active on — every one expands to capture the objective, audience, content types, cadence and growth plan."
        />
      ) : (
        <div className="space-y-2">
          {strategies.map((strategy) => (
            <SocialStrategyCard key={strategy.id} clientId={id} strategy={strategy} />
          ))}
        </div>
      )}
    </div>
  );
}
