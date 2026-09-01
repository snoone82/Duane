"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import {
  previewStrategyImport,
  commitStrategyImport,
  type StrategyImportPreview,
} from "@/lib/actions/platform-strategy-import";

type Stage =
  | { step: "edit" }
  | { step: "review"; preview: StrategyImportPreview }
  | { step: "done"; accountsUpdated: number; fieldsUpdated: number; skipped: string[] };

export function StrategyImportForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  /** Entries PBOS couldn't place, once Duane has said where they go. */
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const runPreview = (nextAssignments: Record<string, string>) =>
    startTransition(async () => {
      const result = await previewStrategyImport(clientId, text, nextAssignments);
      if (!result.ok) setError(result.message);
      else {
        setError(null);
        setStage({ step: "review", preview: result.data });
      }
    });

  function handlePreview() {
    setError(null);
    setAssignments({});
    runPreview({});
  }

  function assign(key: string, accountId: string) {
    const next = { ...assignments };
    if (accountId) next[key] = accountId;
    else delete next[key];
    setAssignments(next);
    // Re-preview so the current → imported comparison is against the account
    // actually chosen, not the one PBOS guessed.
    runPreview(next);
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitStrategyImport(clientId, text, assignments);
      if (!result.ok) setError(result.message);
      else setStage({ step: "done", ...result.data });
    });
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">
          {stage.accountsUpdated} account{stage.accountsUpdated === 1 ? "" : "s"} updated
          {stage.fieldsUpdated > 0 && `, ${stage.fieldsUpdated} field${stage.fieldsUpdated === 1 ? "" : "s"} populated`}.
          {stage.accountsUpdated === 0 && " Everything already matched what was on file."}
        </Notice>
        {stage.skipped.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            Not applied, because no account was chosen for them: {stage.skipped.join(", ")}.
          </p>
        )}
        <div className="mt-4">
          <Link href={`/clients/${clientId}/social`}>
            <Button variant="primary">Back to Social →</Button>
          </Link>
        </div>
      </div>
    );
  }

  const blocked = stage.step === "review" && stage.preview.totals.unmatched > 0;
  const nothingToDo = stage.step === "review" && stage.preview.totals.fields === 0 && !blocked;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="strategy-import-text">Paste the AI&rsquo;s JSON output</Label>
        <Textarea
          id="strategy-import-text"
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (stage.step === "review") setStage({ step: "edit" });
          }}
          placeholder='{ "pbos_import": "social_platform_strategy", "version": 1, "accounts": [ ... ] }'
          className="font-mono text-xs"
        />
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {stage.step === "review" && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold text-ink">Review before applying</h2>

          <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-semibold text-ink">{stage.preview.totals.accounts}</span>{" "}
            <span className="text-ink-soft">account{stage.preview.totals.accounts === 1 ? "" : "s"} will be updated</span>
            {" · "}
            <span className="font-semibold text-ink">{stage.preview.totals.fields}</span>{" "}
            <span className="text-ink-soft">field{stage.preview.totals.fields === 1 ? "" : "s"} will change</span>
            {stage.preview.totals.unmatched > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-danger">{stage.preview.totals.unmatched}</span>{" "}
                <span className="text-ink-soft">need an account choosing</span>
              </>
            )}
          </div>

          {blocked && (
            <Notice kind="danger">
              Choose which account each unmatched entry belongs to. PBOS won&rsquo;t create a new account to make an import
              fit — that&rsquo;s how duplicate accounts happen.
            </Notice>
          )}

          <ul className="space-y-2">
            {stage.preview.entries.map((entry) => (
              <li key={entry.key} className="rounded-md border border-border bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {entry.sourceLabel}
                    {entry.matchedLabel && entry.matchedLabel !== entry.sourceLabel && (
                      <span className="font-normal text-ink-soft"> → {entry.matchedLabel}</span>
                    )}
                  </p>
                  <span className="text-xs text-ink-faint">{entry.matchNote}</span>
                </div>

                {entry.needsChoice ? (
                  <div className="mt-2 max-w-sm">
                    <Label htmlFor={`assign-${entry.key}`}>Apply this strategy to</Label>
                    <Select
                      id={`assign-${entry.key}`}
                      value={assignments[entry.key] ?? ""}
                      onChange={(e) => assign(entry.key, e.target.value)}
                    >
                      <option value="">Choose an account…</option>
                      {entry.choices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : entry.changes.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    Nothing to change — all {entry.unchanged} supplied field{entry.unchanged === 1 ? "" : "s"} already match.
                  </p>
                ) : (
                  <>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-ink-faint">
                            <th className="w-40 py-1 pr-3 text-left font-medium">Field</th>
                            <th className="py-1 pr-3 text-left font-medium">Current</th>
                            <th className="py-1 text-left font-medium">Imported</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.changes.map((c) => (
                            <tr key={c.column} className="border-t border-border align-top">
                              <td className="py-1.5 pr-3 text-ink-soft">{c.label}</td>
                              <td className="py-1.5 pr-3 text-ink-faint">
                                {c.from || <span className="italic">empty</span>}
                              </td>
                              <td className="py-1.5 text-ink">{c.to}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {entry.unchanged > 0 && (
                      <p className="mt-1.5 text-xs text-ink-faint">
                        {entry.unchanged} further field{entry.unchanged === 1 ? "" : "s"} already match and won&rsquo;t be touched.
                      </p>
                    )}
                  </>
                )}

                {entry.warnings.map((w, i) => (
                  <p key={i} className="mt-1 text-xs text-amber-500">
                    ⚠ {w}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          {stage.preview.warnings.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-soft">
              {stage.preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <p className="text-xs text-ink-faint">
            Fields the file leaves blank are never applied, so an import can&rsquo;t wipe anything already recorded.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setStage({ step: "edit" })}>
              Back to editing
            </Button>
            <Button variant="primary" onClick={handleCommit} disabled={isPending || blocked || nothingToDo}>
              {isPending ? "Applying…" : "Confirm & apply strategy"}
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
