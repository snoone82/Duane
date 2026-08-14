"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { updateContentIdeaField, updateContentIdeaStatus, updateContentIdeaPriority, deleteContentIdea } from "@/lib/actions/content";
import { CONTENT_STATUS, CONTENT_PRIORITY } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Idea = Database["public"]["Tables"]["content_ideas"]["Row"];
type Pillar = Database["public"]["Tables"]["brand_pillars"]["Row"];
type Audience = Database["public"]["Tables"]["audiences"]["Row"];

export function ContentIdeaRow({
  clientId,
  idea,
  pillars,
  pillarName,
  audiences,
}: {
  clientId: string;
  idea: Idea;
  pillars: Pillar[];
  pillarName: string | null;
  audiences: Audience[];
}) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: "title" | "body" | "platform" | "format" | "due_date" | "published_url" | "notes" | "pillar_id" | "audience_id" | "reach" | "engagement") =>
    (value: string) => updateContentIdeaField(clientId, idea.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete "${idea.title}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteContentIdea(clientId, idea.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="truncate text-sm text-ink">{idea.title}</span>
          {pillarName && (
            <span className="flex-shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">{pillarName}</span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {idea.due_date && <span className="text-xs text-ink-faint">{formatDate(idea.due_date)}</span>}
          <StatusSelect
            value={idea.priority}
            options={CONTENT_PRIORITY}
            ariaLabel={`Priority for ${idea.title}`}
            onChange={(value) => updateContentIdeaPriority(clientId, idea.id, value)}
          />
          <StatusSelect
            value={idea.status}
            options={CONTENT_STATUS}
            ariaLabel={`Status for ${idea.title}`}
            onChange={(value) => updateContentIdeaStatus(clientId, idea.id, value)}
          />
        </div>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <AutosaveInput id={`idea-title-${idea.id}`} label="Title" initialValue={idea.title} onSave={save("title")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`idea-pillar-${idea.id}`}>Pillar</Label>
            <Select
              id={`idea-pillar-${idea.id}`}
              defaultValue={idea.pillar_id ?? ""}
              onChange={(event) => save("pillar_id")(event.target.value)}
            >
              <option value="">No pillar</option>
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`idea-audience-${idea.id}`}>Audience</Label>
            <Select
              id={`idea-audience-${idea.id}`}
              defaultValue={idea.audience_id ?? ""}
              onChange={(event) => save("audience_id")(event.target.value)}
            >
              <option value="">No audience</option>
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </Select>
          </div>
          <AutosaveInput id={`idea-due-${idea.id}`} label="Due date" type="date" initialValue={idea.due_date ?? ""} onSave={save("due_date")} />
          <AutosaveInput id={`idea-platform-${idea.id}`} label="Platform" initialValue={idea.platform ?? ""} onSave={save("platform")} />
          <AutosaveInput id={`idea-format-${idea.id}`} label="Format" initialValue={idea.format ?? ""} onSave={save("format")} placeholder="e.g. LinkedIn post, short video" />
          <AutosaveInput id={`idea-url-${idea.id}`} label="Published URL" initialValue={idea.published_url ?? ""} onSave={save("published_url")} />
        </div>
        <AutosaveTextarea id={`idea-body-${idea.id}`} label="Body / brief" initialValue={idea.body} onSave={save("body")} rows={3} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id={`idea-reach-${idea.id}`} label="Reach (once measured)" type="number" initialValue={idea.reach?.toString() ?? ""} onSave={save("reach")} />
          <AutosaveInput id={`idea-engagement-${idea.id}`} label="Engagement (once measured)" type="number" initialValue={idea.engagement?.toString() ?? ""} onSave={save("engagement")} />
        </div>
        <AutosaveTextarea id={`idea-notes-${idea.id}`} label="Notes" initialValue={idea.notes} onSave={save("notes")} rows={2} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete idea"}
          </Button>
        </div>
      </div>
    </details>
  );
}
