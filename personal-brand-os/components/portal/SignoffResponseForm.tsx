"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea, Label } from "@/components/ui/Input";
import { respondToSignoff } from "@/lib/actions/signoff";

export function SignoffResponseForm({ signoffId }: { signoffId: string }) {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comments, setComments] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(response: "approved" | "changes_requested") {
    setError(null);
    startTransition(async () => {
      const result = await respondToSignoff(signoffId, response, comments);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-surface p-4">
      <p className="text-sm font-medium text-ink">Ready to make this the agreed plan?</p>
      <p className="mt-1 text-sm text-ink-soft">
        Approving locks this version in as the baseline for your personal brand strategy. If anything reads wrong,
        request changes and tell the team what to adjust.
      </p>

      {mode === "changes" && (
        <div className="mt-3">
          <Label htmlFor="signoff-comments">What would you like changed?</Label>
          <Textarea
            id="signoff-comments"
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. The positioning statement doesn't sound like me — I'd soften the second line."
            autoFocus
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {mode === "idle" ? (
          <>
            <Button variant="secondary" onClick={() => setMode("changes")} disabled={isPending}>
              Request changes
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (window.confirm("Approve this version as your agreed strategy?")) submit("approved");
              }}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Approve"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setMode("idle")} disabled={isPending}>
              Back
            </Button>
            <Button variant="primary" onClick={() => submit("changes_requested")} disabled={isPending || !comments.trim()}>
              {isPending ? "Sending…" : "Send to the team"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
