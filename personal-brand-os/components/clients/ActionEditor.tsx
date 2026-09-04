"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { updateActionDetails } from "@/lib/actions/actions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { ACTION_STATUS, ACTION_PRIORITY, ACTION_VISIBILITY, ACTION_SOURCE_LABELS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { isProductionChecklistText } from "@/lib/production-checklist";
import type { Database } from "@/lib/database.types";

type ActionRowData = Database["public"]["Tables"]["actions"]["Row"];

/** One entry in the grouped owner dropdown. `value` is the encoding the
 * server actions understand: `u:<userId>` for accounts, `n:<name>` for
 * unlinked client-team members. */
export interface OwnerOption {
  value: string;
  label: string;
  group: string;
}

type ChecklistItem = { text: string; done: boolean };

function readChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as ChecklistItem[]).map((item) => ({ text: String(item?.text ?? ""), done: item?.done === true }));
}

const selectClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

/** The Edit Action panel (Duane batch 6): every field of the master task
 * record — title, owner, dates, status, priority, description, visibility,
 * checklist — plus read-only origin (source, linked records) and the client
 * team's portal notes. */
export function ActionEditor({
  clientId,
  action,
  ownerOptions,
  onClose,
}: {
  clientId: string;
  action: ActionRowData;
  ownerOptions: OwnerOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateActionDetails, null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => readChecklist(action.checklist));

  // Preselect the owner: linked account → its option; free-text name that
  // matches a known option → that option; anything else → the custom field.
  const initialOwner = useMemo(() => {
    if (action.owner_user_id) return `u:${action.owner_user_id}`;
    if (action.owner_name) {
      const match = ownerOptions.find((o) => o.value === `n:${action.owner_name}`);
      return match ? match.value : "custom";
    }
    return "";
  }, [action.owner_user_id, action.owner_name, ownerOptions]);
  const [ownerChoice, setOwnerChoice] = useState(initialOwner);
  const [customOwner, setCustomOwner] = useState(initialOwner === "custom" ? (action.owner_name ?? "") : "");

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, OwnerOption[]>();
    for (const option of ownerOptions) {
      const list = byGroup.get(option.group) ?? [];
      list.push(option);
      byGroup.set(option.group, list);
    }
    return [...byGroup.entries()];
  }, [ownerOptions]);

  const ownerValue = ownerChoice === "custom" ? (customOwner.trim() ? `n:${customOwner.trim()}` : "") : ownerChoice;
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <Modal title="Edit action" onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="action_id" value={action.id} />
        <input type="hidden" name="owner" value={ownerValue} />
        <input type="hidden" name="checklist" value={JSON.stringify(checklist.filter((c) => c.text.trim()))} />
        {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}

        <div>
          <Label htmlFor="edit-action-title">Title</Label>
          <Input id="edit-action-title" name="title" defaultValue={action.title} required autoComplete="off" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-action-owner">Owner</Label>
            <select
              id="edit-action-owner"
              className={selectClass}
              value={ownerChoice}
              onChange={(e) => setOwnerChoice(e.target.value)}
            >
              <option value="">Unassigned (defaults to you)</option>
              {groups.map(([group, options]) => (
                <optgroup key={group} label={group}>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">Someone else…</option>
            </select>
            {ownerChoice === "custom" && (
              <Input
                className="mt-1.5"
                value={customOwner}
                onChange={(e) => setCustomOwner(e.target.value)}
                placeholder="Their name"
                aria-label="Owner name"
                autoComplete="off"
              />
            )}
          </div>
          <div>
            <Label htmlFor="edit-action-due">Due date</Label>
            <Input id="edit-action-due" name="due_date" type="date" defaultValue={action.due_date ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="edit-action-status">Status</Label>
            <select id="edit-action-status" name="status" className={selectClass} defaultValue={action.status}>
              {ACTION_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="edit-action-priority">Priority</Label>
            <select id="edit-action-priority" name="priority" className={selectClass} defaultValue={action.priority}>
              {ACTION_PRIORITY.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="edit-action-visibility">Visibility</Label>
            <select id="edit-action-visibility" name="visibility" className={selectClass} defaultValue={action.visibility}>
              {ACTION_VISIBILITY.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="edit-action-description">Description / notes</Label>
          <textarea
            id="edit-action-description"
            name="description"
            defaultValue={action.description}
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <Label>
            Checklist{checklist.length > 0 ? ` — ${doneCount} / ${checklist.length}` : ""}
          </Label>
          <div className="space-y-1.5">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  aria-label={`Done: ${item.text || `item ${index + 1}`}`}
                  className="accent-[--color-accent]"
                  onChange={(e) =>
                    setChecklist((list) => list.map((c, i) => (i === index ? { ...c, done: e.target.checked } : c)))
                  }
                />
                <Input
                  value={item.text}
                  onChange={(e) =>
                    setChecklist((list) => list.map((c, i) => (i === index ? { ...c, text: e.target.value } : c)))
                  }
                  aria-label={`Checklist item ${index + 1}`}
                  className={item.done ? "line-through opacity-60" : ""}
                  autoComplete="off"
                />
                {isProductionChecklistText(item.text) && (
                  <span
                    className="flex-shrink-0 rounded bg-surface-muted px-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint"
                    title="PBOS ticks this automatically once it happens elsewhere in the system — renaming it stops that."
                  >
                    Auto
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove checklist item ${index + 1}`}
                  onClick={() => setChecklist((list) => list.filter((_, i) => i !== index))}
                  className="text-xs text-ink-faint hover:text-danger"
                >
                  Remove
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChecklist((list) => [...list, { text: "", done: false }])}
            >
              + Add checklist item
            </Button>
          </div>
        </div>

        {action.portal_notes.trim() && (
          <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
            <p className="mb-0.5 text-xs font-medium text-ink-soft">Notes from the client team</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{action.portal_notes}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-ink-faint">
          <span>Source: {ACTION_SOURCE_LABELS[action.source] ?? action.source}</span>
          {action.content_id && (
            <Link href={`/clients/${clientId}/content`} className="text-accent underline-offset-2 hover:underline">
              Linked content record →
            </Link>
          )}
          {action.consultation_id && (
            <Link href={`/clients/${clientId}/consultations`} className="text-accent underline-offset-2 hover:underline">
              Linked meeting →
            </Link>
          )}
          <span>Created {formatDate(action.created_at)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
