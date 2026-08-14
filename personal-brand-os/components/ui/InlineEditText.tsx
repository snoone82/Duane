"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * A table-cell-sized editable text/date field — looks like plain text until
 * focused, saves on blur. The compact sibling of AutosaveInput for dense
 * rows (Actions tab, global Actions page) where a full labeled field would
 * blow out row height.
 */
export function InlineEditText({
  initialValue,
  onSave,
  type = "text",
  placeholder,
  ariaLabel,
  className = "",
}: {
  initialValue: string;
  onSave: (value: string) => Promise<ActionResult>;
  type?: string;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(initialValue);

  async function handleBlur() {
    if (value === lastSaved.current) return;
    const result = await onSave(value);
    if (result.ok) {
      lastSaved.current = value;
      setError(null);
    } else {
      setError(result.message);
    }
  }

  return (
    <div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
        className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink hover:border-border focus:border-accent focus:bg-surface ${className}`}
      />
      {error && <p className="px-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
