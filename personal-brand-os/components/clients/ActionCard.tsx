"use client";

import { useState } from "react";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { StatusPill } from "@/components/ui/StatusPill";
import { ActionEditor, type OwnerOption } from "@/components/clients/ActionEditor";
import { updateActionStatus } from "@/lib/actions/actions";
import { ACTION_STATUS, actionPriorityMeta } from "@/lib/status";
import { formatRelativeToToday, isOverdue } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type ActionRowData = Database["public"]["Tables"]["actions"]["Row"];

/** The phone-sized face of an action: everything important at a glance,
 * tap to open the same full editor the table rows use. */
export function ActionCard({
  clientId,
  action,
  clientName,
  ownerLabel,
  ownerOptions = [],
}: {
  clientId: string;
  action: ActionRowData;
  clientName?: string;
  ownerLabel?: string;
  ownerOptions?: OwnerOption[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const overdue = isOverdue(action.due_date) && action.status !== "completed";
  const priority = actionPriorityMeta(action.priority);
  const checklist = Array.isArray(action.checklist) ? (action.checklist as { done: boolean }[]) : [];
  const owner = action.owner_user_id ? (ownerLabel ?? "Team member") : (action.owner_name ?? "Unassigned");

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <button type="button" onClick={() => setIsEditing(true)} className="block w-full text-left">
        <span className="text-[15px] text-ink">{action.title}</span>
        <span className="mt-0.5 block text-xs text-ink-faint">
          {clientName ? `${clientName} · ` : ""}
          {owner}
          {action.due_date && (
            <span className={overdue ? " text-danger" : ""}>
              {" "}· {overdue ? "overdue" : `due ${formatRelativeToToday(action.due_date)}`}
            </span>
          )}
          {checklist.length > 0 && ` · ${checklist.filter((c) => c.done).length}/${checklist.length} done`}
        </span>
      </button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          {action.priority !== "medium" && <StatusPill label={priority.label} color={priority.color} />}
          {action.visibility === "client" && <StatusPill label="Client visible" color="teal" />}
        </span>
        <StatusSelect
          value={action.status}
          options={ACTION_STATUS}
          ariaLabel={`Status for ${action.title}`}
          onChange={(value) => updateActionStatus(clientId, action.id, value)}
        />
      </div>
      {isEditing && (
        <ActionEditor clientId={clientId} action={action} ownerOptions={ownerOptions} onClose={() => setIsEditing(false)} />
      )}
    </div>
  );
}
