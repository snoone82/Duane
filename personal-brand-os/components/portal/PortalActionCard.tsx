"use client";

import { useState, useTransition } from "react";
import { portalUpdateActionStatus, portalToggleChecklistItem, portalSaveActionNote } from "@/lib/actions/portal-actions";
import { ACTION_STATUS, actionStatusMeta, actionPriorityMeta } from "@/lib/status";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatRelativeToToday, isOverdue } from "@/lib/format";
import type { ActionStatus } from "@/lib/enums";
import type { Database } from "@/lib/database.types";

type ActionRowData = Database["public"]["Tables"]["actions"]["Row"];

/** One action in the portal (Duane Part I): the same record the team sees,
 * through the client lens — status, checklist ticks, and a notes field.
 * `canManage` is false for read-only rows (visible but not theirs to
 * update); the database enforces the same rule regardless. */
export function PortalActionCard({
  action,
  ownerLabel,
  canManage,
  contentHref = null,
}: {
  action: ActionRowData;
  ownerLabel: string;
  canManage: boolean;
  /** Link to the content item this action produces, when there is one. */
  contentHref?: string | null;
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(action.portal_notes);
  const [isNoting, setIsNoting] = useState(false);

  const meta = actionStatusMeta(action.status);
  const priority = actionPriorityMeta(action.priority);
  const checklist = Array.isArray(action.checklist) ? (action.checklist as { text: string; done: boolean }[]) : [];
  const doneCount = checklist.filter((c) => c.done).length;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message ?? "Something went wrong.");
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{action.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {ownerLabel}
            {action.due_date && (
              <span className={isOverdue(action.due_date) && action.status !== "completed" ? "text-danger" : ""}>
                {" "}· due {formatRelativeToToday(action.due_date)}
              </span>
            )}
            {action.priority !== "medium" && <span> · {priority.label} priority</span>}
          </p>
        </div>
        {canManage ? (
          <Select
            value={action.status}
            aria-label={`Status for ${action.title}`}
            className="w-auto"
            disabled={isBusy}
            onChange={(e) => run(() => portalUpdateActionStatus(action.id, e.target.value as ActionStatus))}
          >
            {ACTION_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        ) : (
          <StatusPill label={meta.label} color={meta.color} />
        )}
      </div>

      {action.description.trim() && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{action.description}</p>
      )}

      {contentHref && (
        <p className="mt-2">
          <a href={contentHref} className="text-xs font-medium text-accent underline-offset-2 hover:underline">
            View the content this relates to →
          </a>
        </p>
      )}

      {checklist.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-ink-soft">
            Checklist {doneCount} / {checklist.length}
          </p>
          <ul className="space-y-1">
            {checklist.map((item, index) => (
              <li key={index}>
                <label className="inline-flex items-start gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canManage || isBusy}
                    className="mt-0.5 accent-[--color-accent]"
                    onChange={(e) => run(() => portalToggleChecklistItem(action.id, index, e.target.checked))}
                  />
                  <span className={item.done ? "line-through opacity-60" : ""}>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <div className="mt-2">
          {isNoting ? (
            <div className="space-y-1.5">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                aria-label={`Note for ${action.title}`}
                placeholder="Add a note for the Aligned Media team…"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isBusy}
                  onClick={() =>
                    run(async () => {
                      const result = await portalSaveActionNote(action.id, note);
                      if (result.ok) setIsNoting(false);
                      return result;
                    })
                  }
                >
                  Save note
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsNoting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              {action.portal_notes.trim() ? (
                <p className="whitespace-pre-wrap text-xs text-ink-soft">
                  <span className="font-medium">Your note:</span> {action.portal_notes}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setIsNoting(true)}
                className="flex-shrink-0 text-xs text-accent underline-offset-2 hover:underline"
              >
                {action.portal_notes.trim() ? "Edit note" : "Add a note"}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
