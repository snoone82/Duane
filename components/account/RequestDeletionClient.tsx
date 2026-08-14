"use client";

import { useState, useTransition } from "react";
import { requestAccountDeletion } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function RequestDeletionClient({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [requested, setRequested] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requested) {
    return (
      <Notice tone="info">
        Deletion requested — Duane will action this and remove your account and data. There&apos;s
        nothing else for you to do.
      </Notice>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-error bg-error-bg p-4">
      <p className="text-sm text-error">
        This requests permanent deletion of your account and everything you&apos;ve shared —
        audits, CLEAR reflections, goals, check-ins. This can&apos;t be undone once actioned.
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          loading={isPending}
          loadingText="Requesting…"
          onClick={() =>
            startTransition(async () => {
              const result = await requestAccountDeletion();
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setRequested(true);
            })
          }
        >
          Yes, request deletion
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
