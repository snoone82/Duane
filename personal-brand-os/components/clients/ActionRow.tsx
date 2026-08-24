"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InlineEditText } from "@/components/ui/InlineEditText";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { StatusPill } from "@/components/ui/StatusPill";
import { ActionEditor, type OwnerOption } from "@/components/clients/ActionEditor";
import { updateActionField, updateActionStatus, deleteAction, toggleChecklistItem } from "@/lib/actions/actions";
import { ACTION_STATUS, actionPriorityMeta } from "@/lib/status";
import { Td, Tr } from "@/components/ui/Table";
import { isOverdue } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type ActionRowData = Database["public"]["Tables"]["actions"]["Row"];

export function ActionRow({
  clientId,
  action,
  clientName,
  ownerLabel,
  ownerOptions = [],
}: {
  clientId: string;
  action: ActionRowData;
  clientName?: string;
  /** Resolved display name for a team-member owner (owner_user_id set) —
   * shown read-only in the row; reassignment happens in the editor. */
  ownerLabel?: string;
  /** Grouped owner choices for the editor: Aligned Media + this client's team. */
  ownerOptions?: OwnerOption[];
}) {
  const [isDeleting, startDelete] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (field: "due_date" | "owner_name") => (value: string) => updateActionField(clientId, action.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete "${action.title}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteAction(clientId, action.id);
      if (!result.ok) setError(result.message);
    });
  }

  const overdue = isOverdue(action.due_date) && action.status !== "completed";
  const checklist = Array.isArray(action.checklist)
    ? (action.checklist as { text: string; done: boolean }[])
    : [];
  const priority = actionPriorityMeta(action.priority);

  return (
    <Tr>
      {clientName !== undefined && (
        <Td className="p-0">
          <Link href={`/clients/${clientId}/actions`} className="block px-3 py-2 text-sm text-ink hover:underline">
            {clientName}
          </Link>
        </Td>
      )}
      <Td className="p-0">
        {/* The row is the record — clicking the title opens the full editor. */}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="block w-full px-3 pt-2 text-left text-sm text-ink underline-offset-2 hover:text-accent-strong hover:underline"
        >
          {action.title}
        </button>
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1.5 pt-0.5">
          {action.priority !== "medium" && <StatusPill label={priority.label} color={priority.color} />}
          {action.visibility === "client" && <StatusPill label="Client visible" color="teal" />}
          {action.portal_notes.trim() !== "" && <StatusPill label="Client note" color="purple" />}
          {action.content_id && (
            <Link
              href={`/clients/${clientId}/content`}
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              Open content record →
            </Link>
          )}
        </div>
        {checklist.length > 0 && (
          <details className="px-3 pb-1.5">
            <summary className="cursor-pointer list-none text-xs text-ink-faint hover:text-ink">
              Checklist {checklist.filter((c) => c.done).length}/{checklist.length} ▾
            </summary>
            <ul className="mt-1 space-y-0.5">
              {checklist.map((item, index) => (
                <li key={index}>
                  <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={item.done}
                      className="accent-[--color-accent]"
                      onChange={(e) => toggleChecklistItem(clientId, action.id, index, e.target.checked)}
                    />
                    <span className={item.done ? "line-through opacity-60" : ""}>{item.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}
        {error && <p className="px-3 pb-1 text-xs text-danger">{error}</p>}
      </Td>
      <Td className="p-0">
        {action.owner_user_id ? (
          <span className="block px-1.5 py-1 text-sm text-ink-soft">{ownerLabel ?? "Team member"}</span>
        ) : (
          <InlineEditText
            initialValue={action.owner_name ?? ""}
            onSave={save("owner_name")}
            ariaLabel="Owner"
            placeholder="Unassigned"
          />
        )}
      </Td>
      <Td className="p-0">
        <InlineEditText
          type="date"
          initialValue={action.due_date ?? ""}
          onSave={save("due_date")}
          ariaLabel="Due date"
          className={overdue ? "text-danger" : ""}
        />
      </Td>
      <Td>
        <StatusSelect
          value={action.status}
          options={ACTION_STATUS}
          ariaLabel={`Status for ${action.title}`}
          onChange={(value) => updateActionStatus(clientId, action.id, value)}
        />
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsEditing(true)} className="text-xs text-ink-faint hover:text-ink">
            Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-xs text-ink-faint hover:text-danger">
            {isDeleting ? "…" : "Delete"}
          </button>
        </div>
        {isEditing && (
          <ActionEditor clientId={clientId} action={action} ownerOptions={ownerOptions} onClose={() => setIsEditing(false)} />
        )}
      </Td>
    </Tr>
  );
}
