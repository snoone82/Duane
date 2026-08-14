"use client";

import { useState, useTransition } from "react";
import { deleteMilestone } from "@/lib/actions/milestones";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];

export function MilestoneItem({ clientId, milestone, isLast }: { clientId: string; milestone: Milestone; isLast: boolean }) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Delete "${milestone.title}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteMilestone(clientId, milestone.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="relative flex gap-4 pb-6">
      {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />}
      <span
        className={`relative z-10 mt-1.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-surface ${
          milestone.is_highlighted ? "bg-accent" : "bg-border-strong"
        }`}
        aria-hidden
      />
      <div className={`flex-1 rounded-lg border p-3 ${milestone.is_highlighted ? "border-accent-soft bg-accent-soft/40" : "border-border bg-surface"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-ink-faint">{formatDate(milestone.milestone_date)}</p>
            <p className="text-sm font-medium text-ink">
              {milestone.title}
              {milestone.is_highlighted && (
                <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-strong">Highlight</span>
              )}
            </p>
            {milestone.description && <p className="mt-1 text-sm text-ink-soft">{milestone.description}</p>}
          </div>
          <button type="button" onClick={handleDelete} disabled={isDeleting} className="flex-shrink-0 text-xs text-ink-faint hover:text-danger">
            {isDeleting ? "…" : "Delete"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    </li>
  );
}
