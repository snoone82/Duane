"use client";

import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { setMonthlySalesTarget } from "@/lib/actions/sales";

export function SalesTargetForm({ current }: { current: number | null }) {
  return (
    <div className="max-w-xs">
      <AutosaveInput
        id="monthly-sales-target"
        label="Monthly sales target (£)"
        type="number"
        initialValue={current?.toString() ?? ""}
        onSave={(value) => setMonthlySalesTarget(value)}
        placeholder="e.g. 20000"
      />
    </div>
  );
}
