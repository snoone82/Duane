"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Button } from "@/components/ui/Button";
import { updatePillarField, deletePillar } from "@/lib/actions/pillars";
import type { Database } from "@/lib/database.types";

type Pillar = Database["public"]["Tables"]["brand_pillars"]["Row"];

export function PillarCard({ clientId, pillar, ideaCount }: { clientId: string; pillar: Pillar; ideaCount: number }) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (
    field: "name" | "description" | "target_audience" | "purpose" | "key_messages" | "example_topics" | "associated_stories" | "relevant_expertise" | "calls_to_action"
  ) => (value: string) => updatePillarField(clientId, pillar.id, field, value);

  function handleDelete() {
    if (ideaCount > 0) {
      window.alert(`"${pillar.name}" has ${ideaCount} idea${ideaCount === 1 ? "" : "s"} attached — move or delete those first.`);
      return;
    }
    if (!window.confirm(`Delete the "${pillar.name}" pillar?`)) return;
    startDelete(async () => {
      const result = await deletePillar(clientId, pillar.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="text-sm font-medium text-ink">{pillar.name}</span>
          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-ink-soft">{ideaCount}</span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <AutosaveInput id={`pillar-name-${pillar.id}`} label="Name" initialValue={pillar.name} onSave={save("name")} />
        <AutosaveTextarea id={`pillar-desc-${pillar.id}`} label="Description" initialValue={pillar.description} onSave={save("description")} rows={2} />
        <AutosaveTextarea id={`pillar-audience-${pillar.id}`} label="Target audience" initialValue={pillar.target_audience} onSave={save("target_audience")} rows={2} />
        <AutosaveTextarea id={`pillar-purpose-${pillar.id}`} label="Purpose" initialValue={pillar.purpose} onSave={save("purpose")} rows={2} />
        <AutosaveTextarea id={`pillar-messages-${pillar.id}`} label="Key messages" initialValue={pillar.key_messages} onSave={save("key_messages")} rows={2} />
        <AutosaveTextarea id={`pillar-topics-${pillar.id}`} label="Example topics" initialValue={pillar.example_topics} onSave={save("example_topics")} rows={2} />
        <AutosaveTextarea id={`pillar-stories-${pillar.id}`} label="Associated stories" initialValue={pillar.associated_stories} onSave={save("associated_stories")} rows={2} />
        <AutosaveTextarea id={`pillar-expertise-${pillar.id}`} label="Relevant expertise" initialValue={pillar.relevant_expertise} onSave={save("relevant_expertise")} rows={2} />
        <AutosaveTextarea id={`pillar-cta-${pillar.id}`} label="Potential calls to action" initialValue={pillar.calls_to_action} onSave={save("calls_to_action")} rows={2} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete pillar"}
          </Button>
        </div>
      </div>
    </details>
  );
}
