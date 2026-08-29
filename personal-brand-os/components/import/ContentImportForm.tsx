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
  | { step: "done"; created: number; skippedDuplicates: string[]; outputsCreated: number; outputsSkipped: number };

const DECISION_STYLE: Record<string, { dot: string; text: string }> = {
  include: { dot: "bg-success", text: "text-ink-soft" },
  review: { dot: "bg-amber-500", text: "text-ink" },
  exclude: { dot: "bg-ink-faint", text: "text-ink-faint line-through" },
};

export function ContentImportForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  // Selective-repurposing versions are proposed, never assumed — Duane keeps
  // the decision. Keys come straight from the preview so the same text
  // re-parsed at commit lines up exactly.
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggleKey = (key: string) =>
    setApprovedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewContentImport(clientId, text);
      if (!result.ok) setError(result.message);
      else {
        setApprovedKeys(new Set());
        setStage({ step: "review", preview: result.data });
      }
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitContentImport(clientId, text, [...approvedKeys]);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", ...result.data });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">
          {stage.created} content idea{stage.created === 1 ? "" : "s"} imported with {stage.outputsCreated} platform version
          {stage.outputsCreated === 1 ? "" : "s"}.
          {stage.outputsSkipped > 0 && ` ${stage.outputsSkipped} version${stage.outputsSkipped === 1 ? " was" : "s were"} not created, per the platform strategies.`}
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

          {/* The platform mix each account's strategy actually allows. */}
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-sm">
              <span className="font-semibold text-ink">{stage.preview.mixTotals.included}</span>{" "}
              <span className="text-ink-soft">platform version{stage.preview.mixTotals.included === 1 ? "" : "s"} will be created</span>
              {stage.preview.mixTotals.review > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-ink">{stage.preview.mixTotals.review}</span>{" "}
                  <span className="text-ink-soft">proposed for your decision</span>
                </>
              )}
              {stage.preview.mixTotals.excluded > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-ink">{stage.preview.mixTotals.excluded}</span>{" "}
                  <span className="text-ink-soft">excluded by platform strategy</span>
                </>
              )}
            </p>
            {stage.preview.mixTotals.review > 0 && (
              <p className="mt-1 text-xs text-ink-faint">
                Tick anything you want creating. Proposed versions are platforms set to selective repurposing, or accounts that
                aren&rsquo;t fully live — they&rsquo;re never added automatically.
              </p>
            )}
          </div>

          <ul className="space-y-2">
            {stage.preview.ideas.map((idea) => (
              <li key={idea.title} className="rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-sm font-medium text-ink">
                  {idea.title}
                  {idea.duplicate && <span className="ml-2 text-xs text-danger">will be skipped — same title already exists</span>}
                </p>
                {idea.mix.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-faint">No platform versions — the master idea is created on its own.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {idea.mix.map((item) => {
                      const style = DECISION_STYLE[item.decision] ?? DECISION_STYLE.include!;
                      return (
                        <li key={item.key} className="flex items-start gap-2 text-xs">
                          {item.decision === "review" ? (
                            <input
                              type="checkbox"
                              checked={approvedKeys.has(item.key)}
                              onChange={() => toggleKey(item.key)}
                              className="mt-0.5 accent-[--color-accent]"
                              aria-label={`Create ${item.label}`}
                            />
                          ) : (
                            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} aria-hidden />
                          )}
                          <span className="min-w-0">
                            <span className={style.text}>{item.label}</span>
                            <span className="text-ink-faint"> — {item.reason}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
