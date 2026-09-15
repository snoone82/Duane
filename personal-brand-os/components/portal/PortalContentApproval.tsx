"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { portalRespondContent } from "@/lib/actions/portal";

export function PortalContentApproval({ ideaId }: { ideaId: string }) {
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function respond(decision: "approve" | "request_changes") {
    startTransition(async () => {
      const result = await portalRespondContent(ideaId, decision, comments);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {error && <Notice kind="danger">{error}</Notice>}
      {!showComments ? (
        // Approve is the decision this screen exists for, so it carries the
        // weight — full-size, turquoise, first. Request changes sits beside
        // it as the quieter alternative rather than a matching twin.
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => respond("approve")} disabled={isPending}>
            {isPending ? "Saving…" : "Approve this content"}
          </Button>
          <Button variant="ghost" onClick={() => setShowComments(true)} disabled={isPending}>
            Request changes…
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Label htmlFor={`portal-cc-${ideaId}`}>What would you like changed?</Label>
            <Textarea
              id={`portal-cc-${ideaId}`}
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => respond("request_changes")} disabled={isPending}>
              {isPending ? "Sending…" : "Send to the team"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowComments(false)} disabled={isPending}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
