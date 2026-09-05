"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportAiBrief, importAiOutput } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/**
 * The first AI workflow (Duane, 5 Sep 2026): no Claude API here. Generate a
 * brief, a person pastes it into Claude by hand, pastes the JSON that comes
 * back in below. PBOS validates and creates the rows itself — Claude never
 * writes to the database directly.
 */
export function AiBriefPanel({ clientId, planId }: { clientId: string; planId: string }) {
  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();
  const [copied, setCopied] = useState(false);

  const [pasted, setPasted] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isImporting, startImport] = useTransition();
  const router = useRouter();

  function generate() {
    setBriefError(null);
    startGenerate(async () => {
      const result = await exportAiBrief(clientId, planId);
      if (!result.ok) {
        setBriefError(result.message);
        return;
      }
      setBrief(result.data.brief);
    });
  }

  function copyBrief() {
    if (!brief) return;
    navigator.clipboard
      .writeText(brief)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setBriefError("Couldn't copy — your browser blocked clipboard access."));
  }

  function runImport() {
    setImportError(null);
    setImportSummary(null);
    setImportWarnings([]);
    startImport(async () => {
      const result = await importAiOutput(clientId, planId, pasted);
      if (!result.ok) {
        setImportError(result.message);
        return;
      }
      const { masterContentCreated, platformOutputsCreated, requirementsCreated, warnings } = result.data;
      setImportSummary(
        `Imported ${masterContentCreated} Master Content, ${platformOutputsCreated} Platform Output(s), ${requirementsCreated} Requirement(s).`
      );
      setImportWarnings(warnings);
      setPasted("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">1. Generate the AI brief</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Client context from this plan&rsquo;s Client Snapshot, plus the exact JSON shape to return. Paste the whole thing
          into Claude.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={generate} disabled={isGenerating}>
            {isGenerating ? "Generating…" : brief ? "Regenerate brief" : "Generate brief"}
          </Button>
          {brief && (
            <Button variant="ghost" size="sm" onClick={copyBrief}>
              {copied ? "Copied ✓" : "Copy brief"}
            </Button>
          )}
        </div>
        {briefError && <Notice kind="danger">{briefError}</Notice>}
        {brief && <Textarea readOnly rows={10} value={brief} className="mt-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-ink">2. Import Claude&rsquo;s JSON</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Paste exactly what Claude returned. Nothing is written until you click Import — pillar and audience names are
          matched against this client&rsquo;s real records, never created to fit.
        </p>
        <Textarea
          rows={8}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder='{"master_content": [...], "platform_outputs": [...], "requirements": [...]}'
          className="mt-2 font-mono text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={runImport} disabled={isImporting || !pasted.trim()}>
            {isImporting ? "Importing…" : "Import AI output"}
          </Button>
        </div>
        {importError && (
          <Notice kind="danger">
            <pre className="whitespace-pre-wrap font-sans text-xs">{importError}</pre>
          </Notice>
        )}
        {importSummary && <Notice kind="success">{importSummary}</Notice>}
        {importWarnings.length > 0 && (
          <Notice kind="info">
            <ul className="list-disc space-y-0.5 pl-4">
              {importWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
    </div>
  );
}
