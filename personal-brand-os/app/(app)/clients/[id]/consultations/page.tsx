import { createClient } from "@/lib/supabase/server";
import { AddConsultationButton } from "@/components/clients/AddConsultationButton";
import { ConsultationCard } from "@/components/clients/ConsultationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Database } from "@/lib/database.types";

type Action = Database["public"]["Tables"]["actions"]["Row"];

export const metadata = { title: "Consultations" };

export default async function ConsultationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: consultations }, { data: actions }] = await Promise.all([
    supabase.from("consultations").select("*").eq("client_id", id).order("meeting_date", { ascending: false }),
    supabase.from("actions").select("*").eq("client_id", id).not("consultation_id", "is", null),
  ]);

  const actionsByConsultation = new Map<string, Action[]>();
  for (const action of actions ?? []) {
    if (!action.consultation_id) continue;
    const list = actionsByConsultation.get(action.consultation_id) ?? [];
    list.push(action);
    actionsByConsultation.set(action.consultation_id, list);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Internal only — never shown to the client. This is the notes feature.</p>
        <AddConsultationButton clientId={id} />
      </div>

      {!consultations || consultations.length === 0 ? (
        <EmptyState title="No consultations yet" description="Log the first meeting to start the record." />
      ) : (
        <div className="space-y-2">
          {consultations.map((consultation) => (
            <ConsultationCard
              key={consultation.id}
              clientId={id}
              consultation={consultation}
              relatedActions={actionsByConsultation.get(consultation.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
