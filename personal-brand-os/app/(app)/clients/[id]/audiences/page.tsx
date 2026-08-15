import { createClient } from "@/lib/supabase/server";
import { AddAudienceButton } from "@/components/clients/AddAudienceButton";
import { AudienceCard } from "@/components/clients/AudienceCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Audiences" };

export default async function AudiencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: audiences } = await supabase
    .from("audiences")
    .select("*")
    .eq("client_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Who this brand is speaking to.</p>
        <AddAudienceButton clientId={id} />
      </div>

      {!audiences || audiences.length === 0 ? (
        <EmptyState
          title="No audiences yet"
          description="Add the groups this brand is trying to reach — each one expands to capture demographics, pain points and goals."
        />
      ) : (
        <div className="space-y-2">
          {audiences.map((audience, index) => (
            <AudienceCard
              key={audience.id}
              clientId={id}
              audience={audience}
              isFirst={index === 0}
              isLast={index === audiences.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
