"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { previewContentImport, commitContentImport, type ContentImportPreview } from "@/lib/actions/import";

type Stage =
  | { step: "edit" }
  | { step: "review"; preview: ContentImportPreview }
  | { step: "done"; created: number; skippedDuplicates: string[] };

export function ContentImportForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewContentImport(clientId, text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "review", preview: result.data });
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitContentImport(clientId, text);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", ...result.data });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">
          {stage.created} content idea{stage.created === 1 ? "" : "s"} imported with their platform versions.
        </Notice>
        {stage.skippedDuplicates.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            Skipped as likely duplicates (same title already in the pipeline): {stage.skippedDuplicates.join(", ")}
          </p>
        )}
        <div className="mt-4">
          <Link href={`/clients/${clientId}/content`}>
            <Button variant="primary">Back to the Content pipeline →</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="content-import-text">Paste the AI&rsquo;s JSON output</Label>
        <Textarea
          id="content-import-text"
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (stage.step === "review") setStage({ step: "edit" });
          }}
          placeholder='{ "pbos_import": "content", "version": 1, "ideas": [ ... ] }'
          className="font-mono text-xs"
        />
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {stage.step === "review" && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold text-ink">Review before importing</h2>
          <ul className="space-y-2">
            {stage.preview.ideas.map((idea) => (
              <li key={idea.title} className="rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-sm font-medium text-ink">
                  {idea.title}
                  {idea.duplicate && <span className="ml-2 text-xs text-danger">will be skipped — same title already exists</span>}
                </p>
                <p className="text-xs text-ink-faint">{idea.platforms.join(" · ") || "No platform versions"}</p>
                {idea.flags.map((flag, i) => (
                  <p key={i} className="mt-1 text-xs text-amber-500">
                    ⚠ {flag}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          {stage.preview.needsConfirmation.length > 0 && (
            <p className="text-xs text-ink-soft">
              Marked as needing client confirmation (left blank): {stage.preview.needsConfirmation.join("; ")}
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
            <Button variant="primary" onClick={handleCommit} disabled={isPending}>
              {isPending ? "Importing…" : "Confirm & import"}
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
