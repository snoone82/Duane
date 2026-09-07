import { createClient } from "@/lib/supabase/server";
import { AddConsultationButton } from "@/components/clients/AddConsultationButton";
import { ConsultationCard } from "@/components/clients/ConsultationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourceLibraryPanel } from "@/components/clients/SourceLibraryPanel";
import { AnalysisReviewPanel } from "@/components/clients/AnalysisReviewPanel";
import { ImportConsultationButton } from "@/components/clients/ImportConsultationButton";
import type { Database } from "@/lib/database.types";

type Action = Database["public"]["Tables"]["actions"]["Row"];

export const metadata = { title: "Meetings & Consultations" };

export default async function ConsultationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: consultations }, { data: actions }, { data: sourceItems }, { data: pillars }, { data: analyses }] = await Promise.all([
    supabase.from("consultations").select("*").eq("client_id", id).order("meeting_date", { ascending: false }),
    supabase.from("actions").select("*").eq("client_id", id).not("consultation_id", "is", null),
    supabase.from("client_source_items").select("*").eq("client_id", id).order("source_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("brand_pillars").select("id,name").eq("client_id", id).order("sort_order"),
    // Analyses still awaiting review — the extraction is held here, out of
    // the Source Library, until a person approves each item.
    supabase.from("consultation_analyses").select("*").eq("client_id", id).eq("state", "review").order("created_at", { ascending: false }),
  ]);

  const analysisList = analyses ?? [];
  const [{ data: proposals }, { data: suggestions }] = analysisList.length
    ? await Promise.all([
        supabase.from("consultation_source_proposals").select("*").in("analysis_id", analysisList.map((a) => a.id)).order("sort_order"),
        supabase.from("profile_change_suggestions").select("*").in("analysis_id", analysisList.map((a) => a.id)).order("area"),
      ])
    : [{ data: [] }, { data: [] }];

  const consultationLabel = (consultationId: string) => {
    const match = (consultations ?? []).find((c) => c.id === consultationId);
    if (!match) return "consultation";
    return [match.title || match.meeting_type, match.meeting_date].filter(Boolean).join(" · ");
  };

  const actionsByConsultation = new Map<string, Action[]>();
  for (const action of actions ?? []) {
    if (!action.consultation_id) continue;
    const list = actionsByConsultation.get(action.consultation_id) ?? [];
    list.push(action);
    actionsByConsultation.set(action.consultation_id, list);
  }

  return (
    <div className="max-w-3xl space-y-8">
      {analysisList.map((analysis) => (
        <AnalysisReviewPanel
          key={analysis.id}
          clientId={id}
          analysis={{
            id: analysis.id,
            overview: analysis.overview,
            created_at: analysis.created_at,
            consultationLabel: consultationLabel(analysis.consultation_id),
            proposals: (proposals ?? []).filter((p) => p.analysis_id === analysis.id),
            suggestions: (suggestions ?? []).filter((s) => s.analysis_id === analysis.id),
          }}
        />
      ))}
      <SourceLibraryPanel
        clientId={id}
        items={sourceItems ?? []}
        consultations={(consultations ?? []).map((c) => ({ id: c.id, meeting_date: c.meeting_date, meeting_type: c.meeting_type }))}
        pillars={pillars ?? []}
      />
      <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Internal only — never shown to the client. This is the notes feature.</p>
        <div className="flex items-center gap-2">
          <ImportConsultationButton clientId={id} />
          <AddConsultationButton clientId={id} />
        </div>
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
    </div>
  );
}
