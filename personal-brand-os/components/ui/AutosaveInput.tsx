"use client";

import { useRef, useState } from "react";
import { Input, Label } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/action-result";

type Status = "idle" | "saving" | "saved" | "error";

/** Same save-on-blur pattern as AutosaveTextarea, for the single-line
 * contact/detail fields on the Overview tab. */
export function AutosaveInput({
  id,
  label,
  initialValue,
  onSave,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<ActionResult>;
  type?: string;
  placeholder?: string;
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
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
      />
      {status === "error" && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
