"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { previewClientUpdate, commitClientUpdate, type ClientUpdatePreview } from "@/lib/actions/import";

type Stage =
  | { step: "edit" }
  | { step: "review"; preview: ClientUpdatePreview }
  | { step: "done"; applied: ClientUpdatePreview };

const MODE_LABEL: Record<string, string> = {
  upsert: "Update matching records",
  replace: "Replace section",
  append: "Add as new",
};

/** Duane's headline: "7 records will be updated · 0 created · 0 removed" —
 * the whole point is knowing what an import does before confirming it. */
function Totals({ preview, tense }: { preview: ClientUpdatePreview; tense: "will" | "did" }) {
  const { updated, created, removed } = preview.totals;
  const parts = [
    { n: updated, word: tense === "will" ? "will be updated" : "updated" },
    { n: created, word: tense === "will" ? "will be created" : "created" },
    { n: removed, word: tense === "will" ? "will be removed" : "removed" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {parts.map((part) => (
        <span key={part.word} className="text-sm">
          <span className={`font-semibold ${part.n > 0 ? "text-ink" : "text-ink-faint"}`}>{part.n}</span>{" "}
          <span className={part.n > 0 ? "text-ink-soft" : "text-ink-faint"}>
            {part.n === 1 ? "record" : "records"} {part.word}
          </span>
        </span>
      ))}
    </div>
  );
}

function Lines({ title, lines, tone }: { title: string; lines: string[]; tone: "normal" | "faint" | "danger" }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title} · {lines.length}
      </p>
      <ul
        className={`list-inside list-disc text-xs ${
          tone === "danger" ? "text-danger" : tone === "faint" ? "text-ink-faint" : "text-ink-soft"
        }`}
      >
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionList({ preview }: { preview: ClientUpdatePreview }) {
  if (preview.sections.length === 0) {
    return <p className="text-sm text-ink-soft">Nothing to change — everything in the import matches what&rsquo;s already on file.</p>;
  }
  return (
    <ul className="space-y-2">
      {preview.sections.map((section) => (
        <li key={section.label} className="rounded-md border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">{section.label}</p>
            {section.mode && section.mode !== "upsert" && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                {MODE_LABEL[section.mode] ?? section.mode}
              </span>
            )}
          </div>
          <Lines title="Blocked" lines={section.blockers} tone="danger" />
          <Lines title="Updating" lines={section.updates} tone="normal" />
          <Lines title="Creating" lines={section.creates} tone="normal" />
          <Lines title="Removing" lines={section.removes} tone="danger" />
          <Lines title="Left alone" lines={section.skips} tone="faint" />
        </li>
      ))}
    </ul>
  );
}

export function ClientUpdateForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [removalsConfirmed, setRemovalsConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setError(null);
    setRemovalsConfirmed(false);
    startTransition(async () => {
      const result = await previewClientUpdate(clientId, text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "review", preview: result.data });
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitClientUpdate(clientId, text, removalsConfirmed);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", applied: result.data });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">Profile updated. Every change is recorded in the audit history.</Notice>
        <div className="mt-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2">
          <Totals preview={stage.applied} tense="did" />
        </div>
        <div className="mt-4">
          <SectionList preview={stage.applied} />
        </div>
        <div className="mt-4">
          <Link href={`/clients/${clientId}/overview`}>
            <Button variant="primary">Back to the profile →</Button>
          </Link>
        </div>
      </div>
    );
  }

  const blocked = stage.step === "review" && stage.preview.blockers.length > 0;
  const removalsPending = stage.step === "review" && stage.preview.hasRemovals && !removalsConfirmed;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="client-update-text">Paste the AI&rsquo;s JSON output</Label>
        <Textarea
          id="client-update-text"
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (stage.step === "review") setStage({ step: "edit" });
          }}
          placeholder='{ "pbos_import": "client_profile", "version": 1, ... only the sections that changed ... }'
          className="font-mono text-xs"
        />
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {stage.step === "review" && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold text-ink">Review before updating &ldquo;{stage.preview.clientName}&rdquo;</h2>
          {stage.preview.nameMismatch && <Notice kind="danger">{stage.preview.nameMismatch}</Notice>}

          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <Totals preview={stage.preview} tense="will" />
          </div>

          {blocked && (
            <Notice kind="danger">
              <p className="font-medium">
                {stage.preview.blockers.length} record{stage.preview.blockers.length === 1 ? "" : "s"} need a decision before
                anything can be imported — nothing has been changed.
              </p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {stage.preview.blockers.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </Notice>
          )}

          <SectionList preview={stage.preview} />

          {stage.preview.hasRemovals && !blocked && (
            <label className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={removalsConfirmed}
                onChange={(e) => setRemovalsConfirmed(e.target.checked)}
                className="mt-0.5 accent-[--color-danger]"
              />
              <span>
                Yes — remove the {stage.preview.totals.removed} record
                {stage.preview.totals.removed === 1 ? "" : "s"} listed above. They aren&rsquo;t in this import, and a section set
                to <span className="font-medium">Replace</span> treats the imported list as the definitive one.
              </span>
            </label>
          )}

          {stage.preview.needsConfirmation.length > 0 && (
            <p className="text-xs text-ink-soft">
              Marked as needing client confirmation (left blank, added to a follow-up checklist):{" "}
              {stage.preview.needsConfirmation.join("; ")}
            </p>
          )}
          {stage.preview.warnings.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-soft">
              {stage.preview.warnings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setStage({ step: "edit" })}>
              Back to editing
            </Button>
            <Button
              variant="primary"
              onClick={handleCommit}
              disabled={isPending || blocked || removalsPending || stage.preview.sections.length === 0}
            >
              {isPending ? "Updating…" : "Confirm & update profile"}
            </Button>
          </div>
        </div>
      )}

      {stage.step === "edit" && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={handlePreview} disabled={isPending || !text.trim()}>
            {isPending ? "Checking…" : "Preview changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
