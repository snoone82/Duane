"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/Input";
import { updateContentOutputField } from "@/lib/actions/content";
import { checkMediaUrl, type MediaCheckResult } from "@/lib/actions/media-check";
import { inspectMediaUrl } from "@/lib/media-source";

const TONE: Record<string, string> = {
  ok: "text-success",
  warn: "text-amber-500",
  bad: "text-danger",
};

/**
 * Media hosted elsewhere (Duane, 1 Sep): social video doesn't fit a 50 MB
 * upload cap, and Ayrshare can fetch media by URL. Kept separate from the
 * destination link, which is the CTA and must never double as the asset.
 *
 * The Check button matters more than it looks: Ayrshare fetches this URL
 * anonymously from its own servers, so a SharePoint or Teams share link
 * quietly fails at publish time. Checking here says so while it's being
 * pasted.
 */
export function ExternalMediaField({
  clientId,
  outputId,
  field,
  label,
  initialValue,
  helpText,
}: {
  clientId: string;
  outputId: string;
  field: "media_source_url" | "thumbnail_source_url";
  label: string;
  initialValue: string;
  helpText: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [result, setResult] = useState<MediaCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, startCheck] = useTransition();

  const hint = result ? null : inspectMediaUrl(value);

  function commit() {
    const next = value.trim();
    if (next === saved) return;
    setSaved(next);
    setResult(null);
    updateContentOutputField(clientId, outputId, field, next).then((r) => {
      if (!r.ok) setError(r.message);
      else setError(null);
    });
  }

  function check() {
    setError(null);
    startCheck(async () => {
      const r = await checkMediaUrl(value);
      if (!r.ok) {
        setResult(null);
        setError(r.message);
      } else {
        setResult(r.data);
      }
    });
  }

  const id = `${field}-${outputId}`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          onBlur={commit}
          placeholder="https://… direct link to the file"
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={check}
          disabled={isChecking || !value.trim()}
          className="flex-shrink-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
        >
          {isChecking ? "Checking…" : "Check link"}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {result && <p className={`mt-1 text-xs ${TONE[result.verdict] ?? "text-ink-soft"}`}>{result.message}</p>}
      {!error && !result && hint && <p className={`mt-1 text-xs ${TONE[hint.kind] ?? "text-ink-faint"}`}>{hint.message}</p>}
      {!error && !result && !hint && <p className="mt-1 text-xs text-ink-faint">{helpText}</p>}
    </div>
  );
}
