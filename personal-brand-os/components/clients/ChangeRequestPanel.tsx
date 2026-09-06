"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyChangeRequest, declineChangeRequest, requestPlanContentChange } from "@/lib/actions/monthly-plans";
import { CHANGE_REQUEST_FIELDS, planSequenceLabel } from "@/lib/monthly-plan-format";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type ChangeRequest = Database["public"]["Tables"]["master_content_change_requests"]["Row"];

/** Raise a change request on one Master Content item of an approved plan —
 * one field, the new value, and why. The approved version stays until it's
 * applied from the plan's Change requests section. */
export function RequestChangeButton({
  clientId,
  planId,
  ideaId,
  ideaTitle,
  currentValues,
}: {
  clientId: string;
  planId: string;
  ideaId: string;
  ideaTitle: string;
  currentValues: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(CHANGE_REQUEST_FIELDS[0]!.value);
  const [value, setValue] = useState(currentValues[CHANGE_REQUEST_FIELDS[0]!.value] ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const meta = CHANGE_REQUEST_FIELDS.find((f) => f.value === field)!;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestPlanContentChange(clientId, planId, ideaId, field, value, reason);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Request change…
      </Button>
      {open && (
        <Modal title={`Change request — ${ideaTitle}`} onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-ink-soft">
              This plan is approved, so the approved version stays exactly as it is until this request is applied.
            </p>
            {error && <Notice kind="danger">{error}</Notice>}
            <div>
              <Label htmlFor="cr-field">Field</Label>
              <Select
                id="cr-field"
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setValue(currentValues[e.target.value] ?? "");
                }}
              >
                {CHANGE_REQUEST_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cr-value">Proposed {meta.label.toLowerCase()}</Label>
              {meta.multiline ? (
                <Textarea id="cr-value" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
              ) : (
                <Input id="cr-value" value={value} onChange={(e) => setValue(e.target.value)} />
              )}
              {currentValues[field] ? <p className="mt-1 text-xs text-ink-faint">Currently: {currentValues[field]}</p> : null}
            </div>
            <div>
              <Label htmlFor="cr-reason">Reason</Label>
              <Textarea id="cr-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Who asked, and why." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={submit} disabled={isPending}>
                {isPending ? "Saving…" : "Raise change request"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const STATE_META: Record<string, { label: string; color: "amber" | "green" | "slate" }> = {
  open: { label: "Open", color: "amber" },
  applied: { label: "Applied", color: "green" },
  declined: { label: "Declined", color: "slate" },
};

export function ChangeRequestList({
  clientId,
  requests,
  ideaLabels,
}: {
  clientId: string;
  requests: ChangeRequest[];
  /** content_id → "MC-03 · Title" */
  ideaLabels: Map<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function resolve(action: "apply" | "decline", id: string) {
    setError(null);
    startTransition(async () => {
      const result = action === "apply" ? await applyChangeRequest(clientId, id) : await declineChangeRequest(clientId, id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  const describe = (r: ChangeRequest) => {
    if (r.kind === "regeneration") return r.field === "platform_output" ? "Regenerate one Platform Output" : "Regenerate this Master Content item";
    const meta = CHANGE_REQUEST_FIELDS.find((f) => f.value === r.field);
    return `Change ${meta?.label ?? r.field}`;
  };

  return (
    <div className="space-y-2">
      {error && <Notice kind="danger">{error}</Notice>}
      {requests.map((r) => {
        const meta = STATE_META[r.state] ?? STATE_META.open!;
        return (
          <div key={r.id} className="rounded-md border border-border bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-sm text-ink">
                <span className="font-mono text-xs text-ink-faint">{ideaLabels.get(r.content_id) ?? "Master Content"}</span>
                <span className="mx-2 text-ink-faint">·</span>
                <span className="font-medium">{describe(r)}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={meta.label} color={meta.color} />
                {r.state === "open" && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => resolve("apply", r.id)} disabled={isPending}>
                      Apply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => resolve("decline", r.id)} disabled={isPending}>
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
            {r.kind === "field" && (
              <div className="mt-1.5 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="rounded bg-surface-muted/50 p-2">
                  <p className="mb-0.5 text-ink-faint">Approved version</p>
                  <p className="whitespace-pre-wrap text-ink-soft">{r.previous_value || "—"}</p>
                </div>
                <div className="rounded bg-accent/5 p-2">
                  <p className="mb-0.5 text-ink-faint">Proposed</p>
                  <p className="whitespace-pre-wrap text-ink">{r.proposed_value || "—"}</p>
                </div>
              </div>
            )}
            {r.reason && <p className="mt-1.5 text-xs text-ink-soft">Reason: {r.reason}</p>}
            <p className="mt-1 text-xs text-ink-faint">
              Raised {formatDateTime(r.created_at)}
              {r.resolved_at ? ` · resolved ${formatDateTime(r.resolved_at)}` : ""}
              {r.resolution_note ? ` — ${r.resolution_note}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function changeRequestIdeaLabel(seq: number | null, title: string): string {
  return `${planSequenceLabel(seq)} · ${title}`;
}
