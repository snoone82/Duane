"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGoalFromClear } from "@/app/actions/clear";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { GOAL_FREQUENCIES, GOAL_TRACK_METRICS, GOAL_TYPES } from "@/lib/goal-options";
import type { GoalFrequency, GoalTrackMetric, GoalType } from "@/lib/database.types";

export function ClearGoalStepClient({
  clearPlanId,
  lifeAreaId,
  lifeAreaName,
}: {
  clearPlanId: string;
  lifeAreaId: string;
  lifeAreaName: string;
}) {
  const router = useRouter();
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [actionText, setActionText] = useState("");
  const [frequency, setFrequency] = useState<GoalFrequency | null>(null);
  const [frequencyCustom, setFrequencyCustom] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [trackMetric, setTrackMetric] = useState<GoalTrackMetric | null>(null);
  const [trackMetricCustom, setTrackMetricCustom] = useState("");
  const [motivationText, setMotivationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    goalType != null &&
    actionText.trim().length > 0 &&
    frequency != null &&
    successCriteria.trim().length > 0 &&
    trackMetric != null &&
    motivationText.trim().length > 0;

  function handleBack() {
    router.push("/clear?step=3");
  }

  function handleSubmit() {
    if (!goalType || !frequency || !trackMetric) return;
    startTransition(async () => {
      const result = await createGoalFromClear({
        clearPlanId,
        lifeAreaId,
        goalType,
        actionText,
        frequency,
        frequencyCustom: frequency === "custom" ? frequencyCustom : null,
        successCriteria,
        trackMetric,
        trackMetricCustom: trackMetric === "custom" ? trackMetricCustom : null,
        motivationText,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/clear?step=5");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="label-caps text-sm text-gold">A — Aligned Goal</p>
      <h1 className="mt-2 font-heading text-2xl text-ink">
        Choose one clear goal for {lifeAreaName} over the next 30 days.
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        One specific, repeated action creates more change than ten vague intentions.
      </p>

      <div className="mt-8 flex flex-1 flex-col gap-6">
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink">What type of goal is this?</h2>
          <ChoiceRow options={GOAL_TYPES} value={goalType} onChange={setGoalType} name="Goal type" />
        </section>

        <TextAreaField
          id="actionText"
          label="What action will you repeat for the next 30 days?"
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
        />

        <section>
          <h2 className="mb-2 text-sm font-medium text-ink">How often?</h2>
          <ChoiceRow options={GOAL_FREQUENCIES} value={frequency} onChange={setFrequency} name="How often" />
          {frequency === "custom" && (
            <div className="mt-3">
              <TextAreaField
                id="frequencyCustom"
                label="Describe the rhythm"
                value={frequencyCustom}
                onChange={(e) => setFrequencyCustom(e.target.value)}
              />
            </div>
          )}
        </section>

        <TextAreaField
          id="successCriteria"
          label="What would make this a successful 30 days?"
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
        />

        <section>
          <h2 className="mb-2 text-sm font-medium text-ink">What will you track?</h2>
          <ChoiceRow options={GOAL_TRACK_METRICS} value={trackMetric} onChange={setTrackMetric} name="What to track" />
          {trackMetric === "custom" && (
            <div className="mt-3">
              <TextAreaField
                id="trackMetricCustom"
                label="Describe what you'll track"
                value={trackMetricCustom}
                onChange={(e) => setTrackMetricCustom(e.target.value)}
              />
            </div>
          )}
        </section>

        <TextAreaField
          id="motivationText"
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

      <div className="mt-10 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} loading={isPending}>
          Set my goal
        </Button>
      </div>
    </div>
  );
}
