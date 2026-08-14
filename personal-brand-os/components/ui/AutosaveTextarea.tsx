"use client";

import { useRef, useState } from "react";
import { Textarea, Label } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/action-result";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Save-on-blur, quiet indicator — used for every Vision/Positioning field.
 * No Save button: with fourteen fields on a page, a single button at the
 * bottom is how people lose work (brief §4.4). Only saves when the value
 * actually changed since the last save, so tabbing through untouched fields
 * never fires a write.
 */
export function AutosaveTextarea({
  id,
  label,
  helpText,
  initialValue,
  onSave,
  rows = 4,
}: {
  id: string;
  label: string;
  helpText?: string;
  initialValue: string;
  onSave: (value: string) => Promise<ActionResult>;
  rows?: number;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(initialValue);

  async function handleBlur() {
    if (value === lastSaved.current) return;
    setStatus("saving");
    setError(null);
    const result = await onSave(value);
    if (result.ok) {
      lastSaved.current = value;
      setStatus("saved");
      window.setTimeout(() => setStatus((current) => (current === "saved" ? "idle" : current)), 2000);
    } else {
      setStatus("error");
      setError(result.message);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span
          aria-live="polite"
          className="text-xs text-ink-faint transition-opacity duration-150"
          style={{ opacity: status === "saving" || status === "saved" ? 1 : 0 }}
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      {helpText && <p className="mb-1.5 text-xs text-ink-faint">{helpText}</p>}
      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
      />
      {status === "error" && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
