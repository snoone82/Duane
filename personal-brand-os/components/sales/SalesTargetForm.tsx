"use client";

import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { setMonthlySalesTarget } from "@/lib/actions/sales";

/** PBOS's own monthly target — how much business PBOS generates, not how
 * much any client generates. */
export function SalesTargetForm({ current }: { current: number | null }) {
  return (
    <div className="max-w-xs">
      <AutosaveInput
        id="monthly-sales-target"
        label="PBOS monthly target (£)"
        type="number"
        initialValue={current?.toString() ?? ""}
        onSave={(value) => setMonthlySalesTarget(value)}
        placeholder="e.g. 20000"
      />
    </div>
  );
}
