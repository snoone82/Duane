"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createAction } from "@/lib/actions/actions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { ACTION_STATUS, ACTION_PRIORITY, ACTION_VISIBILITY } from "@/lib/status";
import type { OwnerOption } from "@/components/clients/ActionEditor";

type ChecklistItem = { text: string; done: boolean };

/** The expanded Add Action form (Duane batch 6): title, owner (grouped —
 * Aligned Media + this client's team), due date, status, priority,
 * description, checklist and visibility. Source is set automatically to
 * Manual server-side. */
export function AddActionButton({ clientId, ownerOptions = [] }: { clientId: string; ownerOptions?: OwnerOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAction, null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [ownerChoice, setOwnerChoice] = useState("");
  const [customOwner, setCustomOwner] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setIsOpen(false);
      setChecklist([]);
      setOwnerChoice("");
      setCustomOwner("");
    }
  }, [state]);

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

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add action
      </Button>
      {isOpen && (
        <Modal title="Add action" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formData.set("owner", ownerValue);
              formData.set("checklist", JSON.stringify(checklist.filter((c) => c.text.trim())));
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="action-title">Title</Label>
              <Input id="action-title" name="title" required autoFocus autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="action-owner">Owner</Label>
                <Select id="action-owner" value={ownerChoice} onChange={(e) => setOwnerChoice(e.target.value)}>
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
                </Select>
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
                <Label htmlFor="action-due">Due date</Label>
                <Input id="action-due" name="due_date" type="date" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="action-status">Status</Label>
                <Select id="action-status" name="status" defaultValue="not_started">
                  {ACTION_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="action-priority">Priority</Label>
                <Select id="action-priority" name="priority" defaultValue="medium">
                  {ACTION_PRIORITY.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="action-visibility">Visibility</Label>
                <Select id="action-visibility" name="visibility" defaultValue="internal">
                  {ACTION_VISIBILITY.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="action-description">Description / notes</Label>
              <Textarea id="action-description" name="description" rows={3} />
            </div>
            <div>
              <Label>Checklist</Label>
              <div className="space-y-1.5">
                {checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) =>
                        setChecklist((list) => list.map((c, i) => (i === index ? { ...c, text: e.target.value } : c)))
                      }
                      aria-label={`Checklist item ${index + 1}`}
                      autoComplete="off"
                    />
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setChecklist((list) => [...list, { text: "", done: false }])}>
                  + Add checklist item
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add action"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
