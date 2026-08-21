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

function SectionList({ preview }: { preview: ClientUpdatePreview }) {
  if (preview.sections.length === 0) {
    return <p className="text-sm text-ink-soft">Nothing to change — everything in the import matches what&rsquo;s already on file.</p>;
  }
  return (
    <ul className="space-y-2">
      {preview.sections.map((section) => (
        <li key={section.label} className="rounded-md border border-border bg-surface px-3 py-2">
          <p className="text-sm font-medium text-ink">{section.label}</p>
          {section.updates.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Updating</p>
              <ul className="list-inside list-disc text-xs text-ink-soft">
                {section.updates.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {section.creates.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Creating</p>
              <ul className="list-inside list-disc text-xs text-ink-soft">
                {section.creates.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {section.skips.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Left alone</p>
              <ul className="list-inside list-disc text-xs text-ink-faint">
                {section.skips.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ClientUpdateForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewClientUpdate(clientId, text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "review", preview: result.data });
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitClientUpdate(clientId, text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", applied: result.data });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">Profile updated. Every change is recorded in the audit history.</Notice>
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
          <SectionList preview={stage.preview} />
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
              disabled={isPending || stage.preview.sections.length === 0}
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
