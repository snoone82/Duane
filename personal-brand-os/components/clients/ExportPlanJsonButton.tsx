"use client";

import { useState, useTransition } from "react";
import { exportMonthlyPlanJson } from "@/lib/actions/monthly-plans";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * The first PBOS output (Duane, testing Daniel's October plan): just the
 * structured Monthly Plan itself, exportable — for taking manually into
 * Claude to prototype the client-facing sign-off pack. No renderer built
 * into PBOS yet; that comes once the structure and this export are
 * validated against a real client.
 */
export function ExportPlanJsonButton({ clientId, planId, periodLabel }: { clientId: string; planId: string; periodLabel: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function download() {
    setError(null);
    startTransition(async () => {
      const result = await exportMonthlyPlanJson(clientId, planId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const blob = new Blob([result.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${periodLabel.replace(/\s+/g, "-").toLowerCase()}-monthly-plan.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function copyJson() {
    setError(null);
    startTransition(async () => {
      const result = await exportMonthlyPlanJson(clientId, planId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigator.clipboard
        .writeText(result.data.json)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => setError("Couldn't copy — your browser blocked clipboard access."));
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={download} disabled={isPending}>
          {isPending ? "Preparing…" : "Download structured plan (JSON)"}
        </Button>
        <Button variant="ghost" size="sm" onClick={copyJson} disabled={isPending}>
          {copied ? "Copied ✓" : "Copy JSON"}
        </Button>
      </div>
      {error && <Notice kind="danger">{error}</Notice>}
    </div>
  );
}
