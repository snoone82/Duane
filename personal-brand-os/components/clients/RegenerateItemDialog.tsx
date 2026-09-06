"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportItemBrief, importItemRegeneration, type RegenerationTarget } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";

/**
 * Level 2 of Duane's edit levels: regenerate ONE Master Content item, or ONE
 * Platform Output, in place. Same manual round trip as the month brief —
 * PBOS writes the brief, a person pastes it into Claude, pastes the JSON
 * back — but the result updates the existing record. Never a duplicate.
 * On an approved plan the result is queued as a change request instead.
 */
export function RegenerateItemDialog({
  clientId,
  planId,
  target,
  label,
  planLocked,
  onClose,
}: {
  clientId: string;
  planId: string;
  target: RegenerationTarget;
  label: string;
  planLocked: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();
  const [isApplying, startApply] = useTransition();
  const router = useRouter();

  useEffect(() => {
    // Generate on open so the reason can be added before copying — the brief
    // is regenerated when the reason changes (see the button below).
    generate("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generate(withReason: string) {
    setBriefError(null);
    startGenerate(async () => {
      const result = await exportItemBrief(clientId, planId, target, withReason);
      if (!result.ok) setBriefError(result.message);
      else setBrief(result.data.brief);
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

  function apply() {
    setError(null);
    startApply(async () => {
      const result = await importItemRegeneration(clientId, planId, target, pasted, reason);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      if (result.data.queuedAsChangeRequest) {
        window.alert("This plan is approved, so the regeneration has been saved as a change request on this item. Apply it from the Change requests section on the plan.");
      } else if (result.data.warnings.length > 0) {
        window.alert(result.data.warnings.join("\n"));
      }
      onClose();
    });
  }

  const isOutput = target.kind === "output";

  return (
    <Modal title={`Regenerate ${isOutput ? "Platform Output" : "Master Content"} — ${label}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">
          {isOutput
            ? "Only this platform adaptation is redone — the Master Content idea and every other output stay exactly as they are."
            : "Only this idea (and the wording of its existing Platform Outputs) is redone — the rest of the month is untouched. The record keeps its number, dates and media."}
          {planLocked && " This plan is approved, so the result will be saved as a change request for review rather than applied straight away."}
        </p>

        <div>
          <Label htmlFor="regen-reason">Why is it being regenerated?</Label>
          <Textarea id="regen-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Too generic — needs a concrete example from a children's-home setting." />
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => generate(reason)} disabled={isGenerating}>
              {isGenerating ? "Generating…" : brief ? "Regenerate brief with this reason" : "Generate brief"}
            </Button>
            {brief && (
              <Button variant="ghost" size="sm" onClick={copyBrief}>
                {copied ? "Copied ✓" : "Copy brief"}
              </Button>
            )}
          </div>
          {briefError && <Notice kind="danger">{briefError}</Notice>}
          {brief && <Textarea readOnly rows={6} value={brief} className="mt-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />}
        </div>

        <div className="border-t border-border pt-3">
          <Label htmlFor="regen-paste">Paste Claude&rsquo;s JSON</Label>
          <Textarea id="regen-paste" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} className="font-mono text-xs" placeholder={isOutput ? '{"platform_output": {...}}' : '{"master_content": {...}, "platform_outputs": [...]}'} />
          {error && (
            <Notice kind="danger">
              <pre className="whitespace-pre-wrap font-sans text-xs">{error}</pre>
            </Notice>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={apply} disabled={isApplying || !pasted.trim()}>
              {isApplying ? "Applying…" : planLocked ? "Save as change request" : "Apply to this item"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
