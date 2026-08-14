import { createClient } from "@/lib/supabase/server";
import { AddMilestoneButton } from "@/components/clients/AddMilestoneButton";
import { MilestoneItem } from "@/components/clients/MilestoneItem";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Timeline" };

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("client_id", id)
    .order("milestone_date", { ascending: true });

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Newest at the bottom. Highlights are what gets shown at renewal.</p>
        <AddMilestoneButton clientId={id} />
      </div>

      {!milestones || milestones.length === 0 ? (
        <EmptyState title="No milestones yet" description="Add the first one — a launch, a big win, a turning point worth remembering." />
      ) : (
        <ol>
          {milestones.map((milestone, index) => (
            <MilestoneItem key={milestone.id} clientId={id} milestone={milestone} isLast={index === milestones.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}
