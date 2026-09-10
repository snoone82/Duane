"use client";

import { Button } from "@/components/ui/Button";

/** Print, or save as PDF — the browser's own dialog offers both, which is
 * why there is no separate PDF export. The page is built to print. */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      Print / save as PDF
    </Button>
  );
}
