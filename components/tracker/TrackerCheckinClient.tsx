"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCheckin } from "@/app/actions/clear";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { RatingScale } from "@/components/ui/RatingScale";
import { TextAreaField } from "@/components/ui/TextAreaField";

export function TrackerCheckinClient({
  goalId,
  todayKey,
  existing,
}: {
  goalId: string;
  todayKey: string;
  existing: {
    actionCompleted: boolean;
    confidenceScore: number | null;
    selfTrustScore: number | null;
    note: string | null;
  } | null;
}) {
  const router = useRouter();
  const [actionCompleted, setActionCompleted] = useState<boolean | null>(existing?.actionCompleted ?? null);
  const [confidence, setConfidence] = useState<number | null>(existing?.confidenceScore ?? null);
  const [selfTrust, setSelfTrust] = useState<number | null>(existing?.selfTrustScore ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (actionCompleted == null) return;
    startTransition(async () => {
      const result = await saveCheckin({
        goalId,
        checkinDate: todayKey,
        actionCompleted,
        confidenceScore: confidence,
        selfTrustScore: selfTrust,
        note,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-gold bg-gold-soft p-5">
      <p className="label-caps text-xs text-gold-strong">Today&apos;s check-in</p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-ink">Did you complete your action today?</p>
        <div className="flex gap-2">
          <Button
            variant={actionCompleted === true ? "primary" : "secondary"}
            onClick={() => setActionCompleted(true)}
          >
            Yes
          </Button>
          <Button
            variant={actionCompleted === false ? "primary" : "secondary"}
            onClick={() => setActionCompleted(false)}
          >
            Not today
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-ink">Confidence right now</p>
        <RatingScale min={1} max={10} value={confidence} onChange={setConfidence} variant="grid" name="Confidence" />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-ink">Self-trust right now</p>
        <RatingScale min={1} max={10} value={selfTrust} onChange={setSelfTrust} variant="grid" name="Self-trust" />
      </div>

      <div className="mt-6">
        <TextAreaField
          id="checkinNote"
          label="Anything you want to add?"
          optional
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-6">
        <Button onClick={handleSave} disabled={actionCompleted == null} loading={isPending} className="w-full">
          Save today&apos;s check-in
        </Button>
      </div>
    </div>
  );
}
