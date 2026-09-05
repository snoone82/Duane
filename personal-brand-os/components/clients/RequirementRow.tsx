"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/Button";
import { Select, Label } from "@/components/ui/Input";
import { updateRequirementField, deleteRequirement } from "@/lib/actions/monthly-plans";
import { REQUIREMENT_TYPE, REQUIREMENT_STATE, requirementTypeMeta } from "@/lib/status";
import type { Database } from "@/lib/database.types";

type Requirement = Database["public"]["Tables"]["monthly_plan_requirements"]["Row"];

export function RequirementRow({ clientId, requirement }: { clientId: string; requirement: Requirement }) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: "description" | "owner_note" | "due_date" | "related_content_note") => (value: string) =>
    updateRequirementField(clientId, requirement.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete this requirement? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteRequirement(clientId, requirement.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="flex-shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">
            {requirementTypeMeta(requirement.type).label}
          </span>
          <span className="truncate text-sm text-ink">{requirement.description || "(no description)"}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {requirement.due_date && <span className="text-xs text-ink-faint">Due {requirement.due_date}</span>}
          <StatusSelect
            value={requirement.state}
            options={REQUIREMENT_STATE}
            ariaLabel="Requirement state"
            onChange={(value) => updateRequirementField(clientId, requirement.id, "state", value)}
          />
        </div>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <div>
          <Label htmlFor={`req-type-${requirement.id}`}>Type</Label>
          <Select
            id={`req-type-${requirement.id}`}
            defaultValue={requirement.type}
            onChange={(e) => updateRequirementField(clientId, requirement.id, "type", e.target.value)}
          >
            {REQUIREMENT_TYPE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <AutosaveTextarea id={`req-desc-${requirement.id}`} label="Description" initialValue={requirement.description} onSave={save("description")} rows={2} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput
            id={`req-owner-${requirement.id}`}
            label="Owner"
            initialValue={requirement.owner_note}
            onSave={save("owner_note")}
            placeholder="e.g. Client, or Daniel / Charlie"
          />
          <AutosaveInput id={`req-due-${requirement.id}`} label="Due date" type="date" initialValue={requirement.due_date ?? ""} onSave={save("due_date")} />
        </div>
        <AutosaveInput
          id={`req-related-${requirement.id}`}
          label="Related content"
          initialValue={requirement.related_content_note}
          onSave={save("related_content_note")}
          placeholder="e.g. MC-01, MC-02, or “All Instagram outputs”"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete requirement"}
          </Button>
        </div>
      </div>
    </details>
  );
}
