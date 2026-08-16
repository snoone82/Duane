"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InlineEditText } from "@/components/ui/InlineEditText";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { updateActionField, updateActionStatus, deleteAction, toggleChecklistItem } from "@/lib/actions/actions";
import { ACTION_STATUS } from "@/lib/status";
import { Td, Tr } from "@/components/ui/Table";
import { isOverdue } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type ActionRowData = Database["public"]["Tables"]["actions"]["Row"];

export function ActionRow({
  clientId,
  action,
  clientName,
  ownerLabel,
}: {
  clientId: string;
  action: ActionRowData;
  clientName?: string;
  /** Resolved display name for a team-member owner (owner_user_id set) —
   * shown read-only, since reassigning to a different team member isn't a
   * free-text edit. When the action is owned by owner_name instead (a
   * client or external editor, no login), that field stays freely editable. */
  ownerLabel?: string;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: "title" | "due_date" | "owner_name") => (value: string) => updateActionField(clientId, action.id, field, value);

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
        <InlineEditText initialValue={action.title} onSave={save("title")} ariaLabel="Action title" />
        {(checklist.length > 0 || action.content_id) && (
          <div className="px-1.5 pb-1.5">
            {action.content_id && (
              <Link
                href={`/clients/${clientId}/content`}
                className="text-xs text-accent underline-offset-2 hover:underline"
              >
                Open content record →
              </Link>
            )}
            {checklist.length > 0 && (
              <details className="mt-0.5">
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
          </div>
        )}
        {error && <p className="px-1.5 text-xs text-danger">{error}</p>}
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
        <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-xs text-ink-faint hover:text-danger">
          {isDeleting ? "…" : "Delete"}
        </button>
      </Td>
    </Tr>
  );
}
