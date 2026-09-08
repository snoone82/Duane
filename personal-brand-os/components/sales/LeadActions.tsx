"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { createLeadAction, completeLeadAction, deleteLeadAction } from "@/lib/actions/pbos-sales";
import { actionStatusMeta } from "@/lib/status";
import { formatDate, isOverdue } from "@/lib/format";
import type { ActionStatus } from "@/lib/enums";
import type { LeadActionRow, TeamOwner } from "@/components/sales/shared";

/** The next step on a lead or a deal. These are PBOS's own business
 * development tasks — they live apart from the client Actions backlog on
 * purpose, because a lead has no client for that backlog to hang off. */
export function LeadActions({
  leadId,
  opportunityId,
  actions,
  team,
}: {
  leadId: string;
  opportunityId?: string;
  actions: LeadActionRow[];
  team: TeamOwner[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, startTransition] = useTransition();
  const [state, formAction, isPending] = useActionState(createLeadAction, null);

  useEffect(() => {
    if (state?.ok) setShowForm(false);
  }, [state]);

  const open = actions.filter((a) => a.status !== "completed");

  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Next actions</p>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          + Next action
        </Button>
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {showForm && (
        <form
          action={(formData) => {
            formData.set("lead_id", leadId);
            if (opportunityId) formData.set("opportunity_id", opportunityId);
            formAction(formData);
          }}
          className="mb-3 flex flex-wrap items-end gap-2"
        >
          {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
          <Input name="title" placeholder="e.g. Send the Guided proposal" required autoComplete="off" className="min-w-52 flex-1" aria-label="Next action" />
          <Input name="due_date" type="date" aria-label="Due date" className="w-40" />
          <Select name="owner" defaultValue="" aria-label="Owner" className="w-44">
            <option value="">Me</option>
            {team.map((member) => (
              <option key={member.id} value={`u:${member.id}`}>
                {member.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" size="sm" disabled={isPending}>
            {isPending ? "Adding…" : "Add"}
          </Button>
        </form>
      )}

      {open.length === 0 ? (
        <p className="text-xs text-ink-faint">Nothing queued — every live deal should have a next action.</p>
      ) : (
        <ul className="space-y-1.5">
          {open.map((action) => {
            const meta = actionStatusMeta(action.status as ActionStatus);
            return (
              <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{action.title}</span>
                  <span className="ml-2 text-xs text-ink-faint">
                    {action.ownerLabel}
                    {action.due_date && (
                      <span className={isOverdue(action.due_date) ? " text-danger" : ""}> · due {formatDate(action.due_date)}</span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill label={meta.label} color={meta.color} />
                  <button
                    type="button"
                    disabled={isBusy}
                    className="text-xs text-accent underline-offset-2 hover:underline"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await completeLeadAction(action.id);
                        if (!result.ok) setError(result.message);
                      })
                    }
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    className="text-xs text-ink-faint hover:text-danger"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteLeadAction(action.id);
                        if (!result.ok) setError(result.message);
                      })
                    }
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
