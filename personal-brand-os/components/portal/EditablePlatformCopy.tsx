"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { portalUpdateOutputCopy } from "@/lib/actions/portal";

/**
 * The caption for one platform, which the client can correct themselves.
 *
 * Duane's distinction, and the reason this is separate from Request changes:
 * a change to the VIDEO is work for the team, so it goes back through the
 * comments workflow — but a change to the WORDS is just the client writing
 * the words. Saving here updates the live platform version, so whatever
 * stands when they press Approve is what gets scheduled.
 *
 * Read-only until they choose to edit. The default state of a review screen
 * is reading, and a page of open textareas reads like a form to fill in
 * rather than content to approve.
 */
export function EditablePlatformCopy({
  outputId,
  caption,
  platformLabel,
  canEdit,
}: {
  outputId: string;
  caption: string;
  /** Named in the buttons so a screen of five platforms stays unambiguous. */
  platformLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [saved, setSaved] = useState(caption);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await portalUpdateOutputCopy(outputId, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(draft.trim());
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setDraft(saved);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="mt-3">
        {saved ? (
          <p className="review-measure whitespace-pre-wrap text-sm leading-relaxed text-ink">{saved}</p>
        ) : (
          <p className="text-sm text-ink-faint">No copy written for this platform yet.</p>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
            }}
            className="mt-2 text-xs font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            {saved ? "Edit copy" : "Add copy"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Textarea
        aria-label={`${platformLabel} copy`}
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        className="review-measure"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
