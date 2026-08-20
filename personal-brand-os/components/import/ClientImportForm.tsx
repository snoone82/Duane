"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { previewClientImport, commitClientImport, type ClientImportPreview } from "@/lib/actions/import";

type Stage =
  | { step: "edit" }
  | { step: "review"; preview: ClientImportPreview }
  | { step: "done"; clientId: string; created: string[] };

export function ClientImportForm() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewClientImport(text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "review", preview: result.data });
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitClientImport(text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", clientId: result.data.clientId, created: result.data.created });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">Client imported successfully.</Notice>
        <h2 className="mb-2 mt-4 text-sm font-semibold text-ink">What was created</h2>
        <ul className="mb-4 list-inside list-disc space-y-0.5 text-sm text-ink-soft">
          {stage.created.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link href={`/clients/${stage.clientId}/overview`}>
          <Button variant="primary">Open the new client →</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="client-import-text">Paste the AI&rsquo;s JSON output</Label>
        <Textarea
          id="client-import-text"
          rows={14}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (stage.step === "review") setStage({ step: "edit" });
          }}
          placeholder='{ "pbos_import": "client_profile", "version": 1, ... }'
          className="font-mono text-xs"
        />
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {stage.step === "review" && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold text-ink">
            Review before creating &ldquo;{stage.preview.clientName}&rdquo;
          </h2>
          {stage.preview.duplicateWarning && <Notice kind="danger">{stage.preview.duplicateWarning}</Notice>}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Will be created</p>
            <ul className="space-y-1">
              {stage.preview.sections.map((section) => (
                <li key={section.label} className="text-sm text-ink-soft">
                  <span className="font-medium text-ink">
                    {section.label}
                    {section.count > 1 ? ` · ${section.count}` : ""}
                  </span>
                  {section.preview.length > 0 && (
                    <span className="text-ink-faint"> — {section.preview.slice(0, 6).join(", ")}{section.preview.length > 6 ? "…" : ""}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {stage.preview.needsConfirmation.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Needs client confirmation · {stage.preview.needsConfirmation.length}
              </p>
              <p className="mb-1 text-xs text-ink-soft">
                These stay blank; a follow-up Action with this checklist is created automatically.
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-soft">
                {stage.preview.needsConfirmation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {stage.preview.warnings.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Warnings · {stage.preview.warnings.length}
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-soft">
                {stage.preview.warnings.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setStage({ step: "edit" })}>
              Back to editing
            </Button>
            <Button variant="primary" onClick={handleCommit} disabled={isPending}>
              {isPending ? "Creating…" : "Confirm & create client"}
            </Button>
          </div>
        </div>
      )}

      {stage.step === "edit" && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={handlePreview} disabled={isPending || !text.trim()}>
            {isPending ? "Checking…" : "Preview import"}
          </Button>
        </div>
      )}
    </div>
  );
}
