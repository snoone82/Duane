"use client";

import { useState, useTransition } from "react";
import type { TagColor } from "@/lib/status";
import type { ActionResult } from "@/lib/action-result";

const colorClass: Record<TagColor, string> = {
  slate: "bg-[--tag-slate-bg] text-[--tag-slate-text]",
  blue: "bg-[--tag-blue-bg] text-[--tag-blue-text]",
  cyan: "bg-[--tag-cyan-bg] text-[--tag-cyan-text]",
  teal: "bg-[--tag-teal-bg] text-[--tag-teal-text]",
  green: "bg-[--tag-green-bg] text-[--tag-green-text]",
  amber: "bg-[--tag-amber-bg] text-[--tag-amber-text]",
  orange: "bg-[--tag-orange-bg] text-[--tag-orange-text]",
  purple: "bg-[--tag-purple-bg] text-[--tag-purple-text]",
  pink: "bg-[--tag-pink-bg] text-[--tag-pink-text]",
  red: "bg-[--tag-red-bg] text-[--tag-red-text]",
};

/**
 * Status changeable inline, without opening the record — the brief's
 * explicit call for content/authority pipelines. Colour-coded to match the
 * StatusPill used everywhere else so a row never wears two different looks
 * for the same status.
 */
export function StatusSelect<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: V;
  options: { value: V; label: string; color: TagColor }[];
  onChange: (value: V) => Promise<ActionResult>;
  ariaLabel: string;
}) {
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const meta = options.find((option) => option.value === current) ?? options[0]!;

  function handleChange(next: V) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const result = await onChange(next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.message);
      }
    });
  }

  return (
    <div className="inline-flex flex-col">
      <select
        aria-label={ariaLabel}
        value={current}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as V)}
        className={`h-7 cursor-pointer rounded-full border-0 bg-transparent pl-2 pr-6 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${colorClass[meta.color]}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-0.5 text-xs text-danger">{error}</span>}
    </div>
  );
}
