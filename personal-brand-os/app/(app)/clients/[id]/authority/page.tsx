import { createClient } from "@/lib/supabase/server";
import { AddAuthorityButton } from "@/components/clients/AddAuthorityButton";
import { AuthorityRow } from "@/components/clients/AuthorityRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { AUTHORITY_STATUS } from "@/lib/status";

export const metadata = { title: "Authority" };

export default async function AuthorityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: opportunities } = await supabase
    .from("authority_opportunities")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const list = opportunities ?? [];
  const groups = AUTHORITY_STATUS.map((status) => ({
    status,
    items: list.filter((o) => o.status === status.value),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Podcasts, speaking, panels, press — the credibility pipeline.</p>
        <AddAuthorityButton clientId={id} />
      </div>

      {list.length === 0 ? (
        <EmptyState title="No opportunities yet" description="Add the first speaking, podcast or press opportunity to start the pipeline." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.status.value}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {group.status.label} · {group.items.length}
              </h3>
              <div className="space-y-2">
                {group.items.map((opportunity) => (
                  <AuthorityRow key={opportunity.id} clientId={id} opportunity={opportunity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
