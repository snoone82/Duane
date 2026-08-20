"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** The copyable AI instruction template — the fixed format contract between
 * whatever AI drafts the import and what the OS will accept. */
export function TemplateBox({ template, label }: { template: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-faint">show ▾</span>
      </summary>
      <div className="border-t border-border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-ink-soft">
            Copy this, paste it into your AI, put the source material after it, then paste the AI&rsquo;s JSON answer into the box
            below.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(template).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? "Copied ✓" : "Copy template"}
          </Button>
        </div>
        <pre className="max-h-72 overflow-auto rounded-md bg-surface-muted/50 p-3 text-xs leading-5 text-ink-soft">{template}</pre>
      </div>
    </details>
  );
}
