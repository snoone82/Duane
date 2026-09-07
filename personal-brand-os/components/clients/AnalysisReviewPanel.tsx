"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { Textarea } from "@/components/ui/Input";
import { sourceItemKindMeta, SOURCE_ITEM_KINDS } from "@/lib/monthly-plan-format";
import { profileAreaLabel } from "@/lib/consultation-analysis";
import {
  approveSourceProposal,
  rejectSourceProposal,
  approveAllSourceProposals,
  setProfileSuggestionState,
  completeAnalysisReview,
  discardAnalysis,
} from "@/lib/actions/consultation-analysis";

export interface SourceProposal {
  id: string;
  kind: string;
  text: string;
  source_quote: string;
  sensitivity: string;
  state: string;
}

export interface ProfileSuggestion {
  id: string;
  area: string;
  field_label: string;
  current_value: string;
  suggested_value: string;
  rationale: string;
  evidence_quote: string;
  state: string;
}

export interface AnalysisForReview {
  id: string;
  overview: string;
  created_at: string;
  consultationLabel: string;
  proposals: SourceProposal[];
  suggestions: ProfileSuggestion[];
}

const STATE_PILL: Record<string, { label: string; color: "green" | "red" }> = {
  approved: { label: "Saved", color: "green" },
  rejected: { label: "Rejected", color: "red" },
};

/**
 * Review of one analysis before anything is kept.
 *
 * Two lists, deliberately separate (Duane): extracted source material, which
 * approving writes into the Source Library; and suggested profile changes,
 * which approving only records — a consultation is evidence, the profile is
 * interpretation, and the strategy edit stays a human action.
 */
export function AnalysisReviewPanel({ clientId, analysis }: { clientId: string; analysis: AnalysisForReview }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { text: string; kind: string }>>({});
  const [isPending, startTransition] = useTransition();

  const pending = analysis.proposals.filter((p) => p.state === "pending");
  const decided = analysis.proposals.filter((p) => p.state !== "pending");
  const pendingSuggestions = analysis.suggestions.filter((s) => s.state === "pending");

  function run(id: string, work: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await work();
      setBusyId(null);
      if (!result.ok) setError(result.message ?? "That didn't work.");
      else router.refresh();
    });
  }

  const editFor = (p: SourceProposal) => edits[p.id] ?? { text: p.text, kind: p.kind };

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Review extraction — {analysis.consultationLabel}
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            {pending.length > 0
              ? `${pending.length} source item${pending.length === 1 ? "" : "s"} found`
              : "All source items reviewed"}
            {pendingSuggestions.length > 0 && ` · ${pendingSuggestions.length} suggested profile change${pendingSuggestions.length === 1 ? "" : "s"}`}
            . Nothing is saved until you approve it.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {pending.length > 0 && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() => run("all", () => approveAllSourceProposals(clientId, analysis.id))}
            >
              {busyId === "all" ? "Saving…" : `Approve all ${pending.length}`}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() => run("done", () => completeAnalysisReview(clientId, analysis.id))}
          >
            Done
          </Button>
        </div>
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {analysis.overview && (
        <p className="mb-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-soft">{analysis.overview}</p>
      )}

      {pending.length === 0 && decided.length === 0 && analysis.suggestions.length === 0 && (
        <p className="text-xs text-ink-soft">Nothing was extracted from this consultation.</p>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((proposal) => {
            const edit = editFor(proposal);
            return (
              <li key={proposal.id} className="rounded-md border border-line bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <select
                    value={edit.kind}
                    aria-label="Kind of source item"
                    onChange={(event) => setEdits((e) => ({ ...e, [proposal.id]: { ...edit, kind: event.target.value } }))}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
                  >
                    {SOURCE_ITEM_KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                  {proposal.sensitivity === "sensitive" && (
                    <span title="Kept as context for understanding the client, never offered to content generation.">
                      <StatusPill label="Sensitive — context only" color="amber" />
                    </span>
                  )}
                </div>
                <Textarea
                  rows={2}
                  value={edit.text}
                  aria-label="The extracted item"
                  onChange={(event) => setEdits((e) => ({ ...e, [proposal.id]: { ...edit, text: event.target.value } }))}
                />
                {proposal.source_quote && (
                  <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-xs italic text-ink-soft">
                    “{proposal.source_quote}”
                  </blockquote>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="primary"
                    disabled={isPending}
                    onClick={() =>
                      run(proposal.id, () =>
                        approveSourceProposal(clientId, proposal.id, {
                          kind: edit.kind,
                          text: edit.text,
                          sensitivity: proposal.sensitivity === "sensitive" ? "sensitive" : "public",
                        })
                      )
                    }
                  >
                    {busyId === proposal.id ? "Saving…" : "Approve"}
                  </Button>
                  <Button variant="ghost" disabled={isPending} onClick={() => run(proposal.id, () => rejectSourceProposal(clientId, proposal.id))}>
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <ul className="mt-3 space-y-1">
          {decided.map((proposal) => {
            const pill = STATE_PILL[proposal.state];
            return (
              <li key={proposal.id} className="flex items-start gap-2 text-xs text-ink-soft">
                {pill && <StatusPill label={pill.label} color={pill.color} />}
                <span className="min-w-0">
                  <span className="text-ink-faint">{sourceItemKindMeta(proposal.kind).label} · </span>
                  {proposal.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Suggested Profile Changes</h3>
          <p className="mt-0.5 mb-3 text-xs text-ink-soft">
            Reviewed separately, and never applied automatically — a consultation is evidence, the profile is strategic
            interpretation. Approving records the decision; make the edit itself on the relevant tab.
          </p>
          <ul className="space-y-2">
            {analysis.suggestions.map((suggestion) => (
              <li key={suggestion.id} className="rounded-md border border-line bg-surface p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusPill label={profileAreaLabel(suggestion.area)} color="blue" />
                  {suggestion.field_label && <span className="text-xs font-medium text-ink">{suggestion.field_label}</span>}
                  {STATE_PILL[suggestion.state] && (
                    <StatusPill label={STATE_PILL[suggestion.state]!.label} color={STATE_PILL[suggestion.state]!.color} />
                  )}
                </div>
                {suggestion.current_value && (
                  <p className="text-xs text-ink-faint">
                    <span className="font-medium">Now:</span> {suggestion.current_value}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink">
                  <span className="font-medium">Suggested:</span> {suggestion.suggested_value}
                </p>
                {suggestion.rationale && <p className="mt-1 text-xs text-ink-soft">{suggestion.rationale}</p>}
                {suggestion.evidence_quote && (
                  <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-xs italic text-ink-soft">
                    “{suggestion.evidence_quote}”
                  </blockquote>
                )}
                {suggestion.state === "pending" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="primary" disabled={isPending} onClick={() => run(suggestion.id, () => setProfileSuggestionState(clientId, suggestion.id, "approved"))}>
                      {busyId === suggestion.id ? "Saving…" : "Accept"}
                    </Button>
                    <Button variant="ghost" disabled={isPending} onClick={() => run(suggestion.id, () => setProfileSuggestionState(clientId, suggestion.id, "rejected"))}>
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm("Discard this extraction? The consultation and its transcript are kept — only the AI's interpretation of it goes.")) return;
            run("discard", () => discardAnalysis(clientId, analysis.id));
          }}
          className="text-xs text-danger underline-offset-2 hover:underline disabled:opacity-60"
        >
          Discard this extraction
        </button>
      </div>
    </section>
  );
}
