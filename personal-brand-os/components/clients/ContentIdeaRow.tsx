"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import {
  updateContentIdeaField,
  updateContentIdeaStatus,
  updateContentIdeaPriority,
  deleteContentIdea,
  approveForProduction,
  requestContentChanges,
  addContentOutput,
} from "@/lib/actions/content";
import { CONTENT_STATUS, CONTENT_PRIORITY } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/format";
import { ContentOutputRow } from "@/components/clients/ContentOutputRow";
import type { Database } from "@/lib/database.types";

type Idea = Database["public"]["Tables"]["content_ideas"]["Row"];
type Output = Database["public"]["Tables"]["content_outputs"]["Row"];
type Pillar = Database["public"]["Tables"]["brand_pillars"]["Row"];
type Audience = Database["public"]["Tables"]["audiences"]["Row"];
export type TeamMember = { id: string; name: string };
export type PublishingAccount = { id: string; label: string };
export type HistoryEntry = { at: string; by: string; summary: string };


export function ContentIdeaRow({
  clientId,
  idea,
  outputs,
  pillars,
  pillarName,
  audiences,
  team,
  accounts = [],
  history = [],
  defaultOpen = false,
}: {
  clientId: string;
  idea: Idea;
  outputs: Output[];
  pillars: Pillar[];
  pillarName: string | null;
  audiences: Audience[];
  team: TeamMember[];
  accounts?: PublishingAccount[];
  history?: HistoryEntry[];
  defaultOpen?: boolean;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [isTransitioning, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  const save = (
    field: "title" | "body" | "hook" | "due_date" | "notes" | "pillar_id" | "audience_id" | "approver_user_id" | "production_due_date" | "target_publish_date"
  ) => (value: string) => updateContentIdeaField(clientId, idea.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete "${idea.title}" and all its platform versions? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteContentIdea(clientId, idea.id);
      if (!result.ok) setError(result.message);
    });
  }

  function moveTo(status: Idea["status"]) {
    startTransition(async () => {
      const result = await updateContentIdeaStatus(clientId, idea.id, status);
      if (!result.ok) setError(result.message);
    });
  }

  const accountLabel = (output: Output) =>
    (output.social_account_id && accounts.find((a) => a.id === output.social_account_id)?.label) || output.platform;
  const platformSummary = outputs.map(accountLabel).join(" · ");

  return (
    <details className="group rounded-lg border border-border bg-surface" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="truncate text-sm text-ink">{idea.title}</span>
          {pillarName && (
            <span className="flex-shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">{pillarName}</span>
          )}
          {platformSummary && <span className="hidden flex-shrink-0 text-xs text-ink-faint sm:inline">{platformSummary}</span>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {idea.target_publish_date && (
            <span className="text-xs text-ink-faint" title="Target publication date">{formatDate(idea.target_publish_date)}</span>
          )}
          <StatusSelect
            value={idea.priority}
            options={CONTENT_PRIORITY}
            ariaLabel={`Priority for ${idea.title}`}
            onChange={(value) => updateContentIdeaPriority(clientId, idea.id, value)}
          />
          <StatusSelect
            value={idea.status}
            options={CONTENT_STATUS}
            ariaLabel={`Status for ${idea.title}`}
            onChange={(value) => updateContentIdeaStatus(clientId, idea.id, value)}
          />
        </div>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {/* Workflow shortcuts for the current stage */}
        <div className="flex flex-wrap items-center gap-2">
          {idea.status === "idea" && (
            <Button variant="primary" size="sm" onClick={() => setShowApprove(true)}>
              Approve for production…
            </Button>
          )}
          {(idea.status === "approved_production" || idea.status === "changes_requested") && (
            <Button variant="secondary" size="sm" onClick={() => moveTo("in_production")} disabled={isTransitioning}>
              Start production
            </Button>
          )}
          {idea.status === "in_production" && (
            <Button variant="primary" size="sm" onClick={() => moveTo("ready_for_approval")} disabled={isTransitioning}>
              Ready for approval
            </Button>
          )}
          {idea.status === "ready_for_approval" && (
            <>
              <Button variant="primary" size="sm" onClick={() => moveTo("ready_to_schedule")} disabled={isTransitioning}>
                Approve — ready to schedule
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowChanges(true)}>
                Request changes…
              </Button>
            </>
          )}
          {idea.action_id && (
            <Link
              href={`/clients/${clientId}/actions`}
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              View production action →
            </Link>
          )}
        </div>

        {idea.approval_comments && (
          <Notice kind={idea.status === "changes_requested" ? "danger" : "info"}>
            <span className="font-medium">Approval comments:</span> {idea.approval_comments}
          </Notice>
        )}

        {/* Master (strategic) fields */}
        <AutosaveInput id={`idea-title-${idea.id}`} label="Title" initialValue={idea.title} onSave={save("title")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`idea-pillar-${idea.id}`}>Pillar</Label>
            <Select
              id={`idea-pillar-${idea.id}`}
              defaultValue={idea.pillar_id ?? ""}
              onChange={(event) => save("pillar_id")(event.target.value)}
            >
              <option value="">No pillar</option>
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`idea-audience-${idea.id}`}>Audience</Label>
            <Select
              id={`idea-audience-${idea.id}`}
              defaultValue={idea.audience_id ?? ""}
              onChange={(event) => save("audience_id")(event.target.value)}
            >
              <option value="">No audience</option>
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`idea-approver-${idea.id}`}>Approver</Label>
            <Select
              id={`idea-approver-${idea.id}`}
              defaultValue={idea.approver_user_id ?? ""}
              onChange={(event) => save("approver_user_id")(event.target.value)}
            >
              <option value="">No approver set</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <AutosaveInput id={`idea-proddue-${idea.id}`} label="Production due" type="date" initialValue={idea.production_due_date ?? ""} onSave={save("production_due_date")} />
          <AutosaveInput id={`idea-target-${idea.id}`} label="Target publish date" type="date" initialValue={idea.target_publish_date ?? ""} onSave={save("target_publish_date")} />
          <AutosaveInput id={`idea-due-${idea.id}`} label="Due date (work)" type="date" initialValue={idea.due_date ?? ""} onSave={save("due_date")} />
        </div>
        <AutosaveInput id={`idea-hook-${idea.id}`} label="Hook" initialValue={idea.hook} onSave={save("hook")} placeholder="The opening line / angle that earns attention" />
        <AutosaveTextarea id={`idea-body-${idea.id}`} label="Brief / body" initialValue={idea.body} onSave={save("body")} rows={3} />
        <AutosaveTextarea id={`idea-notes-${idea.id}`} label="Notes" initialValue={idea.notes} onSave={save("notes")} rows={2} />

        {/* Platform outputs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Platform versions · {outputs.length}
            </h4>
            <AddOutputInline clientId={clientId} contentId={idea.id} accounts={accounts} />
          </div>
          {outputs.length === 0 ? (
            <p className="text-xs text-ink-faint">
              No platform versions yet — they&rsquo;re created when the idea is approved for production, or add one manually.
            </p>
          ) : (
            <div className="space-y-2">
              {outputs.map((output) => (
                <ContentOutputRow key={output.id} clientId={clientId} output={output} accounts={accounts} />
              ))}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <details className="rounded-md border border-border bg-surface-muted/30">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink">
              History · {history.length} ▾
            </summary>
            <ul className="space-y-1 border-t border-border px-3 py-2">
              {history.map((entry, i) => (
                <li key={i} className="text-xs text-ink-faint">
                  <span className="text-ink-soft">{formatDateTime(entry.at)}</span> · {entry.by} — {entry.summary}
                </li>
              ))}
            </ul>
          </details>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete idea"}
          </Button>
        </div>
      </div>

      {showApprove && (
        <ApproveProductionModal
          clientId={clientId}
          idea={idea}
          team={team}
          accounts={accounts}
          onClose={() => setShowApprove(false)}
        />
      )}
      {showChanges && (
        <RequestChangesModal
          clientId={clientId}
          ideaId={idea.id}
          onClose={() => setShowChanges(false)}
        />
      )}
    </details>
  );
}

/** Duane's §1 confirm dialog: owner, dates, platforms, requirements,
 * approver — submitting creates the linked production Action + outputs. */
function ApproveProductionModal({
  clientId,
  idea,
  team,
  accounts = [],
  onClose,
}: {
  clientId: string;
  idea: Idea;
  team: TeamMember[];
  accounts?: PublishingAccount[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(approveForProduction, null);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <Modal title={`Approve for production — ${idea.title}`} onClose={onClose}>
      <form
        action={(formData) => {
          formData.set("client_id", clientId);
          formData.set("idea_id", idea.id);
          formAction(formData);
        }}
        className="space-y-3"
      >
        {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ap-owner">Owner</Label>
            <Select id="ap-owner" name="owner_user_id" defaultValue="">
              <option value="">Someone else (name below)</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ap-owner-name">Owner name (if not a team member)</Label>
            <Input id="ap-owner-name" name="owner_name" autoComplete="off" placeholder="e.g. freelance editor" />
          </div>
          <div>
            <Label htmlFor="ap-prod-due">Production due date</Label>
            <Input id="ap-prod-due" name="production_due_date" type="date" />
          </div>
          <div>
            <Label htmlFor="ap-target">Target publication date</Label>
            <Input id="ap-target" name="target_publish_date" type="date" />
          </div>
        </div>
        <div>
          <Label>Publishing accounts</Label>
          {accounts.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1.5">
              {accounts.map((account) => (
                <label key={account.id} className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                  <input type="checkbox" name="accounts" value={account.id} className="accent-[--color-accent]" />
                  {account.label}
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">
              No publishing accounts on the Social tab yet — add them there, or type a platform below for a one-off.
            </p>
          )}
          <Input name="platform_other" autoComplete="off" placeholder="One-off platform (no account)…" className="mt-2" />
        </div>
        <div>
          <Label htmlFor="ap-req">Content requirements</Label>
          <Textarea id="ap-req" name="requirements" rows={3} placeholder="Format, angle, must-include points, references…" />
        </div>
        <div>
          <Label htmlFor="ap-approver">Approver</Label>
          <Select id="ap-approver" name="approver_user_id" defaultValue="">
            <option value="">No approver set</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-ink-faint">
          This creates a linked production Action with the standard checklist, and one platform version per publishing
          account ticked.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Setting up…" : "Approve & create action"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestChangesModal({
  clientId,
  ideaId,
  onClose,
}: {
  clientId: string;
  ideaId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await requestContentChanges(clientId, ideaId, comments);
      if (!result.ok) setError(result.message);
      else onClose();
    });
  }

  return (
    <Modal title="Request changes" onClose={onClose}>
      <div className="space-y-3">
        {error && <Notice kind="danger">{error}</Notice>}
        <div>
          <Label htmlFor="rc-comments">What needs to change?</Label>
          <Textarea id="rc-comments" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} autoFocus />
        </div>
        <p className="text-xs text-ink-faint">The linked production Action reopens and goes back to its owner.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={isPending}>
            {isPending ? "Sending…" : "Send back for changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddOutputInline({
  clientId,
  contentId,
  accounts = [],
}: {
  clientId: string;
  contentId: string;
  accounts?: PublishingAccount[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addContentOutput, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  if (!isOpen) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        + Add platform version
      </Button>
    );
  }

  return (
    <form
      action={(formData) => {
        formData.set("client_id", clientId);
        formData.set("content_id", contentId);
        formAction(formData);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      {state && !state.ok && <span className="text-xs text-danger">{state.message}</span>}
      {accounts.length > 0 ? (
        <Select name="account_id" defaultValue="" className="w-56" autoFocus>
          <option value="">One-off platform (type it) →</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </Select>
      ) : null}
      <Input name="platform" autoComplete="off" placeholder="Platform (if no account)" className="w-36" autoFocus={accounts.length === 0} />
      <Input name="format" autoComplete="off" placeholder="Format" className="w-32" />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? "…" : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
