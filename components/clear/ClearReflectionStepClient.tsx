"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeClearPlan, saveClearStep } from "@/app/actions/clear";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { ReflectionStep } from "@/lib/clear-steps";

export function ClearReflectionStepClient({
  clearPlanId,
  stepConfig,
  personalizedIntro,
  existingValues,
}: {
  clearPlanId: string;
  stepConfig: ReflectionStep;
  /** e.g. "Based on what you told us about Career — you rated it 4/10." Quotes the person's own audit answers rather than claiming AI analysis that isn't happening — see lib/recommended-focus.ts for the same principle applied elsewhere. */
  personalizedIntro: string | null;
  existingValues: Record<string, string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(stepConfig.fields.map((f) => [f.key, existingValues[f.key] ?? ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    startTransition(async () => {
      const saveResult = await saveClearStep({ clearPlanId, step: stepConfig.step, fields: values });
      if (!saveResult.ok) {
        setError(saveResult.message);
        return;
      }

      if (stepConfig.step === 5) {
        const completeResult = await completeClearPlan(clearPlanId);
        if (!completeResult.ok) {
          setError(completeResult.message);
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      router.push(`/clear?step=${stepConfig.step + 1}`);
      router.refresh();
    });
  }

  function handleBack() {
    if (stepConfig.step <= 1) return;
    router.push(`/clear?step=${stepConfig.step - 1}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="label-caps text-sm text-gold">
        {stepConfig.letter} — {stepConfig.title}
      </p>
      <h1 className="mt-2 font-heading text-2xl text-ink">{stepConfig.tagline}</h1>
      {personalizedIntro && <p className="mt-3 text-sm leading-snug text-ink-soft">{personalizedIntro}</p>}

      <div className="mt-8 flex flex-1 flex-col gap-6">
        {stepConfig.fields.map((field) => (
          <TextAreaField
            key={field.key}
            id={field.key}
            label={field.label}
            value={values[field.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            optional
          />
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={handleBack} disabled={stepConfig.step <= 1}>
          Back
        </Button>
        <Button onClick={handleNext} loading={isPending}>
          {stepConfig.step === 5 ? "Finish CLEAR" : "Next"}
        </Button>
      </div>
    </div>
  );
}
