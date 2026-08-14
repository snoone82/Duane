"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { QuickAddActionForm } from "@/components/clients/QuickAddActionForm";
import { updateConsultationField, deleteConsultation } from "@/lib/actions/consultations";
import { actionStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Consultation = Database["public"]["Tables"]["consultations"]["Row"];
type Action = Database["public"]["Tables"]["actions"]["Row"];

type Field =
  | "meeting_date"
  | "meeting_type"
  | "next_meeting_date"
  | "attendees"
  | "summary"
  | "client_updates"
  | "wins"
  | "challenges"
  | "strategic_observations"
  | "decisions_made"
  | "content_discussed"
  | "commercial_opportunities";

export function ConsultationCard({
  clientId,
  consultation,
  relatedActions,
}: {
  clientId: string;
  consultation: Consultation;
  relatedActions: Action[];
}) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: Field) => (value: string) => updateConsultationField(clientId, consultation.id, field, value);

  function handleDelete() {
    if (!window.confirm("Delete this consultation? Its linked actions will stay, unlinked. This can't be undone.")) return;
    startDelete(async () => {
      const result = await deleteConsultation(clientId, consultation.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="text-sm font-medium text-ink">{formatDate(consultation.meeting_date)}</span>
          {consultation.meeting_type && (
            <span className="flex-shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">{consultation.meeting_type}</span>
          )}
          {consultation.attendees && <span className="truncate text-xs text-ink-soft">{consultation.attendees}</span>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 text-xs text-ink-faint">
          {consultation.next_meeting_date && <span>Next: {formatDate(consultation.next_meeting_date)}</span>}
          {relatedActions.length > 0 && <span>{relatedActions.length} action{relatedActions.length === 1 ? "" : "s"}</span>}
        </div>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AutosaveInput id={`cons-date-${consultation.id}`} label="Meeting date" type="date" initialValue={consultation.meeting_date} onSave={save("meeting_date")} />
          <AutosaveInput id={`cons-type-${consultation.id}`} label="Meeting type" initialValue={consultation.meeting_type ?? ""} onSave={save("meeting_type")} placeholder="e.g. Strategy session" />
          <AutosaveInput id={`cons-next-${consultation.id}`} label="Next meeting" type="date" initialValue={consultation.next_meeting_date ?? ""} onSave={save("next_meeting_date")} />
        </div>
        <AutosaveInput id={`cons-attendees-${consultation.id}`} label="Attendees" initialValue={consultation.attendees} onSave={save("attendees")} />
        <AutosaveTextarea id={`cons-summary-${consultation.id}`} label="Summary" initialValue={consultation.summary} onSave={save("summary")} rows={3} />
        <AutosaveTextarea id={`cons-updates-${consultation.id}`} label="Client updates" initialValue={consultation.client_updates} onSave={save("client_updates")} rows={2} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveTextarea id={`cons-wins-${consultation.id}`} label="Wins since previous meeting" initialValue={consultation.wins} onSave={save("wins")} rows={2} />
          <AutosaveTextarea id={`cons-challenges-${consultation.id}`} label="Challenges" initialValue={consultation.challenges} onSave={save("challenges")} rows={2} />
        </div>
        <AutosaveTextarea id={`cons-observations-${consultation.id}`} label="Strategic observations" initialValue={consultation.strategic_observations} onSave={save("strategic_observations")} rows={2} />
        <AutosaveTextarea id={`cons-decisions-${consultation.id}`} label="Decisions made" initialValue={consultation.decisions_made} onSave={save("decisions_made")} rows={2} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveTextarea id={`cons-content-${consultation.id}`} label="Content discussed" initialValue={consultation.content_discussed} onSave={save("content_discussed")} rows={2} />
          <AutosaveTextarea id={`cons-opportunities-${consultation.id}`} label="Commercial opportunities" initialValue={consultation.commercial_opportunities} onSave={save("commercial_opportunities")} rows={2} />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">Actions from this consultation</p>
          {relatedActions.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {relatedActions.map((action) => {
                const meta = actionStatusMeta(action.status);
                return (
                  <li key={action.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink">{action.title}</span>
                    <StatusPill label={meta.label} color={meta.color} />
                  </li>
                );
              })}
            </ul>
          )}
          <QuickAddActionForm clientId={clientId} consultationId={consultation.id} />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete consultation"}
          </Button>
        </div>
      </div>
    </details>
  );
}
