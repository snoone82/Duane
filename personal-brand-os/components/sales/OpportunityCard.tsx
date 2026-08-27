"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import {
  updateOpportunityField,
  setOpportunityStage,
  createOpportunityAction,
  deleteOpportunity,
} from "@/lib/actions/sales-pipeline";
import { updateActionStatus } from "@/lib/actions/actions";
import { SALES_STAGES, salesStageMeta, actionStatusMeta } from "@/lib/status";
import { formatCurrency, formatDate, isOverdue } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Opportunity = Database["public"]["Tables"]["sales_opportunities"]["Row"];

export interface OpportunityAction {
  id: string;
  title: string;
  status: Database["public"]["Enums"]["action_status"];
  due_date: string | null;
  ownerLabel: string;
  completed_at: string | null;
}

export interface TeamOwner {
  id: string;
  label: string;
}

export function OpportunityCard({
  opportunity,
  clientName,
  clientStatus,
  actions,
  team,
}: {
  opportunity: Opportunity;
  clientName: string;
  clientStatus: string;
  actions: OpportunityAction[];
  team: TeamOwner[];
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddAction, setShowAddAction] = useState(false);
  const [actionState, actionFormAction, actionPending] = useActionState(createOpportunityAction, null);

  useEffect(() => {
    if (actionState?.ok) setShowAddAction(false);
  }, [actionState]);

  const stageMeta = salesStageMeta(opportunity.stage);
  const openActions = actions.filter((a) => a.status !== "completed");
  const doneActions = actions.filter((a) => a.status === "completed");
  const nextAction = openActions[0];
  const save = (field: "title" | "contact_name" | "source" | "notes" | "expected_close" | "estimated_value" | "probability") =>
    (value: string) => updateOpportunityField(opportunity.id, field, value);

  function changeStage(stage: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setOpportunityStage(opportunity.id, stage);
      if (!result.ok) setError(result.message);
      else if (result.data) setNotice(result.data);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete the "${opportunity.title}" opportunity for ${clientName}? Its history goes with it.`)) return;
    startTransition(async () => {
      const result = await deleteOpportunity(opportunity.id);
      if (!result.ok) setError(result.message);
    });
  }

  const history = Array.isArray(opportunity.stage_history)
    ? (opportunity.stage_history as { stage: string; at: string }[])
    : [];
  const timeline = [
    ...history.map((h) => ({ at: h.at, label: `Stage → ${salesStageMeta(h.stage).label}` })),
    ...doneActions.filter((a) => a.completed_at).map((a) => ({ at: a.completed_at as string, label: `Done: ${a.title}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const valueLine =
    opportunity.estimated_value !== null
      ? `${formatCurrency(opportunity.estimated_value)}${opportunity.value_type === "monthly" ? "/mo" : ""}`
      : "—";

  return (
    <details className="group rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{clientName}</span>
            {clientStatus === "prospect" && <StatusPill label="Prospect" color="slate" />}
            <span className="text-sm text-ink-soft">· {opportunity.title}</span>
          </span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {valueLine} · {opportunity.probability}% likely
            {opportunity.expected_close && ` · closes ${formatDate(opportunity.expected_close)}`}
            {nextAction && (
              <span className={nextAction.due_date && isOverdue(nextAction.due_date) ? " text-danger" : ""}>
                {" "}· next: {nextAction.title}
              </span>
            )}
            {!nextAction && opportunity.stage !== "won" && opportunity.stage !== "lost" && (
              <span className="text-warning"> · no next action set</span>
            )}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <StatusPill label={stageMeta.label} color={stageMeta.color} />
          <span aria-hidden className="text-xs text-ink-faint transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-4">
        {notice && <Notice kind="success">{notice}</Notice>}
        {error && <Notice kind="danger">{error}</Notice>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-44">
            <Label htmlFor={`opp-stage-${opportunity.id}`}>Stage</Label>
            <Select
              id={`opp-stage-${opportunity.id}`}
              value={opportunity.stage}
              disabled={isBusy}
              onChange={(e) => changeStage(e.target.value)}
            >
              {SALES_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Marking <span className="text-success">Won</span> converts a prospect into an active client — same record, history kept.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AutosaveInput id={`opp-title-${opportunity.id}`} label="Service / offer" initialValue={opportunity.title} onSave={save("title")} />
          <AutosaveInput id={`opp-contact-${opportunity.id}`} label="Contact" initialValue={opportunity.contact_name} onSave={save("contact_name")} />
          <AutosaveInput id={`opp-source-${opportunity.id}`} label="Source" initialValue={opportunity.source} onSave={save("source")} placeholder="Referral, LinkedIn, event…" />
          <AutosaveInput id={`opp-value-${opportunity.id}`} label={`Estimated value (${opportunity.value_type === "monthly" ? "per month" : "project"})`} type="number" initialValue={opportunity.estimated_value?.toString() ?? ""} onSave={save("estimated_value")} />
          <AutosaveInput id={`opp-prob-${opportunity.id}`} label="Probability %" type="number" initialValue={String(opportunity.probability)} onSave={save("probability")} />
          <AutosaveInput id={`opp-close-${opportunity.id}`} label="Expected close" type="date" initialValue={opportunity.expected_close ?? ""} onSave={save("expected_close")} />
        </div>
        <AutosaveTextarea id={`opp-notes-${opportunity.id}`} label="Notes" initialValue={opportunity.notes} onSave={save("notes")} rows={2} />

        {/* Next actions — real Actions, linked to this opportunity */}
        <div className="rounded-md border border-border bg-surface-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Next actions</p>
            <Button variant="secondary" size="sm" onClick={() => setShowAddAction((v) => !v)}>
              + Next action
            </Button>
          </div>
          {showAddAction && (
            <form
              action={(formData) => {
                formData.set("opportunity_id", opportunity.id);
                formData.set("client_id", opportunity.client_id);
                actionFormAction(formData);
              }}
              className="mb-3 flex flex-wrap items-end gap-2"
            >
              {actionState && !actionState.ok && <Notice kind="danger">{actionState.message}</Notice>}
              <Input name="title" placeholder="e.g. Send proposal" required autoComplete="off" className="min-w-52 flex-1" aria-label="Next action" />
              <Input name="due_date" type="date" aria-label="Due date" className="w-40" />
              <Select name="owner" defaultValue="" aria-label="Owner" className="w-44">
                <option value="">Me</option>
                {team.map((member) => (
                  <option key={member.id} value={`u:${member.id}`}>
                    {member.label}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="primary" size="sm" disabled={actionPending}>
                {actionPending ? "Adding…" : "Add"}
              </Button>
            </form>
          )}
          {openActions.length === 0 ? (
            <p className="text-xs text-ink-faint">Nothing queued — every live opportunity should have a next action.</p>
          ) : (
            <ul className="space-y-1.5">
              {openActions.map((action) => {
                const meta = actionStatusMeta(action.status);
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
                        className="text-xs text-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await updateActionStatus(opportunity.client_id, action.id, "completed");
                            if (!result.ok) setError(result.message);
                          })
                        }
                      >
                        Done
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Timeline</p>
            <ul className="space-y-1">
              {timeline.map((item, index) => (
                <li key={index} className="text-xs">
                  <span className="text-ink-soft">{item.label}</span>
                  <span className="ml-2 text-ink-faint">{formatDate(item.at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="flex gap-3 text-xs">
            <Link href={`/clients/${opportunity.client_id}/overview`} className="text-accent underline-offset-2 hover:underline">
              Open client record →
            </Link>
            <Link href={`/clients/${opportunity.client_id}/consultations`} className="text-accent underline-offset-2 hover:underline">
              Meetings →
            </Link>
          </span>
          <button type="button" onClick={handleDelete} disabled={isBusy} className="text-xs text-ink-faint hover:text-danger">
            Delete opportunity
          </button>
        </div>
      </div>
    </details>
  );
}
