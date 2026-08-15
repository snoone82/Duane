"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Button } from "@/components/ui/Button";
import { ReorderButtons } from "@/components/ui/ReorderButtons";
import { updateAudienceField, deleteAudience, moveAudience } from "@/lib/actions/audiences";
import type { Database } from "@/lib/database.types";

type Audience = Database["public"]["Tables"]["audiences"]["Row"];

export function AudienceCard({
  clientId,
  audience,
  isFirst,
  isLast,
}: {
  clientId: string;
  audience: Audience;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (
    field: "name" | "description" | "demographics" | "stage" | "pain_points" | "goals" | "content_interests" | "target_belief" | "target_action" | "where_they_are" | "notes"
  ) => (value: string) => updateAudienceField(clientId, audience.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete "${audience.name}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteAudience(clientId, audience.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface" open={!audience.description && !audience.pain_points}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-ink">{audience.name}</span>
        <span className="flex items-center gap-1">
          <ReorderButtons
            isFirst={isFirst}
            isLast={isLast}
            label={audience.name}
            onMove={(direction) => moveAudience(clientId, audience.id, direction)}
          />
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <AutosaveInput id={`aud-name-${audience.id}`} label="Name" initialValue={audience.name} onSave={save("name")} />
        <AutosaveTextarea id={`aud-desc-${audience.id}`} label="Who are they?" initialValue={audience.description} onSave={save("description")} rows={2} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveTextarea id={`aud-demo-${audience.id}`} label="Demographics" initialValue={audience.demographics} onSave={save("demographics")} rows={2} />
          <AutosaveTextarea id={`aud-stage-${audience.id}`} label="What stage are they at?" initialValue={audience.stage} onSave={save("stage")} rows={2} />
          <AutosaveTextarea id={`aud-pain-${audience.id}`} label="What problems do they experience?" initialValue={audience.pain_points} onSave={save("pain_points")} rows={2} />
          <AutosaveTextarea id={`aud-goals-${audience.id}`} label="What do they want?" initialValue={audience.goals} onSave={save("goals")} rows={2} />
          <AutosaveTextarea id={`aud-content-${audience.id}`} label="What content interests them?" initialValue={audience.content_interests} onSave={save("content_interests")} rows={2} />
          <AutosaveTextarea id={`aud-where-${audience.id}`} label="Where they are" initialValue={audience.where_they_are} onSave={save("where_they_are")} rows={2} />
        </div>
        <AutosaveTextarea id={`aud-belief-${audience.id}`} label="What does the client want them to think?" initialValue={audience.target_belief} onSave={save("target_belief")} rows={2} />
        <AutosaveTextarea id={`aud-action-${audience.id}`} label="What does the client want them to do?" initialValue={audience.target_action} onSave={save("target_action")} rows={2} />
        <AutosaveTextarea id={`aud-notes-${audience.id}`} label="Notes" initialValue={audience.notes} onSave={save("notes")} rows={2} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete audience"}
          </Button>
        </div>
      </div>
    </details>
  );
}
