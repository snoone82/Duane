"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupportingGoal } from "@/app/actions/clear";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { GOAL_FREQUENCIES, GOAL_TRACK_METRICS, GOAL_TYPES } from "@/lib/goal-options";
import type { GoalFrequency, GoalTrackMetric, GoalType } from "@/lib/database.types";

export function AddSupportingGoalClient({
  lifeAreas,
  slotsRemaining,
}: {
  lifeAreas: { id: string; name: string }[];
  slotsRemaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lifeAreaId, setLifeAreaId] = useState("");
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [actionText, setActionText] = useState("");
  const [frequency, setFrequency] = useState<GoalFrequency | null>(null);
  const [successCriteria, setSuccessCriteria] = useState("");
  const [trackMetric, setTrackMetric] = useState<GoalTrackMetric | null>(null);
  const [motivationText, setMotivationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (slotsRemaining <= 0) return null;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        Add a supporting goal
      </Button>
    );
  }

  const canSubmit =
    lifeAreaId && goalType && actionText.trim() && frequency && successCriteria.trim() && trackMetric && motivationText.trim();

  function handleSubmit() {
    if (!goalType || !frequency || !trackMetric) return;
    startTransition(async () => {
      const result = await createSupportingGoal({
        lifeAreaId,
        goalType,
        actionText,
        frequency,
        frequencyCustom: null,
        successCriteria,
        trackMetric,
        trackMetricCustom: null,
        motivationText,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-paper-raised p-5">
      <h3 className="font-heading text-base text-ink">Add a supporting goal</h3>
      <p className="mt-1 text-sm text-ink-soft">{slotsRemaining} slot{slotsRemaining === 1 ? "" : "s"} remaining.</p>

      <div className="mt-4 flex flex-col gap-5">
        <div>
          <label htmlFor="supportingArea" className="mb-2 block text-sm text-ink-soft">
            Life area
          </label>
          <select
            id="supportingArea"
            value={lifeAreaId}
            onChange={(e) => setLifeAreaId(e.target.value)}
            className="min-h-[var(--tap-target-min)] w-full rounded-md border border-border bg-paper-raised px-4 text-base text-ink focus:border-gold"
          >
            <option value="">Choose an area…</option>
            {lifeAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm text-ink-soft">What type of goal is this?</p>
          <ChoiceRow options={GOAL_TYPES} value={goalType} onChange={setGoalType} name="Goal type" />
        </div>

        <TextAreaField
          id="supportingAction"
          label="What action will you repeat for the next 30 days?"
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
        />

        <div>
          <p className="mb-2 text-sm text-ink-soft">How often?</p>
          <ChoiceRow options={GOAL_FREQUENCIES.filter((f) => f.value !== "custom")} value={frequency} onChange={setFrequency} name="How often" />
        </div>

        <TextAreaField
          id="supportingSuccess"
          label="What would make this a successful 30 days?"
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
        />

        <div>
          <p className="mb-2 text-sm text-ink-soft">What will you track?</p>
          <ChoiceRow options={GOAL_TRACK_METRICS.filter((m) => m.value !== "custom")} value={trackMetric} onChange={setTrackMetric} name="What to track" />
        </div>

        <TextAreaField
          id="supportingMotivation"
          label="Why does this matter to you?"
          value={motivationText}
          onChange={(e) => setMotivationText(e.target.value)}
        />
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} loading={isPending}>
          Add goal
        </Button>
      </div>
    </div>
  );
}
