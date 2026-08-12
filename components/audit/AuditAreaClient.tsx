"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAuditResponse } from "@/app/actions/audit";
import { RatingScale } from "@/components/ui/RatingScale";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Logo } from "@/components/ui/Logo";
import { navigateWithTransition } from "@/lib/view-transition";

type LifeArea = { id: string; name: string; description: string };

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AuditAreaClient({
  auditId,
  area,
  stepIndex,
  totalSteps,
  existingResponse,
}: {
  auditId: string;
  area: LifeArea;
  stepIndex: number;
  totalSteps: number;
  existingResponse: { satisfactionScore: number; importanceScore: number; note: string | null } | null;
}) {
  const router = useRouter();
  const [satisfaction, setSatisfaction] = useState<number | null>(
    existingResponse?.satisfactionScore ?? null
  );
  const [importance, setImportance] = useState<number | null>(
    existingResponse?.importanceScore ?? null
  );
  const [note, setNote] = useState(existingResponse?.note ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const noteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when the area changes (navigating back/forward).
  useEffect(() => {
    setSatisfaction(existingResponse?.satisfactionScore ?? null);
    setImportance(existingResponse?.importanceScore ?? null);
    setNote(existingResponse?.note ?? "");
    setStatus("idle");
    setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.id]);

  async function save(overrides?: { satisfaction?: number; importance?: number }) {
    const s = overrides?.satisfaction ?? satisfaction;
    const i = overrides?.importance ?? importance;
    if (s == null || i == null) return { ok: true as const };

    setStatus("saving");
    const result = await saveAuditResponse({
      auditId,
      lifeAreaId: area.id,
      satisfactionScore: s,
      importanceScore: i,
      note,
    });

    if (result.ok) {
      setStatus("saved");
      setErrorMessage(null);
    } else {
      setStatus("error");
      setErrorMessage(result.message);
    }
    return result;
  }

  function handleSatisfaction(value: number) {
    setSatisfaction(value);
    if (importance != null) void save({ satisfaction: value });
  }

  function handleImportance(value: number) {
    setImportance(value);
    if (satisfaction != null) void save({ importance: value });
  }

  function handleNoteChange(value: string) {
    setNote(value);
    if (satisfaction == null || importance == null) return;
    if (noteDebounce.current) clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => void save(), 600);
  }

  const canContinue = satisfaction != null && importance != null;

  function handleContinue() {
    startTransition(async () => {
      const result = await save();
      if (!result.ok) return;

      if (stepIndex >= totalSteps) {
        navigateWithTransition(() => router.push("/audit/leverage"));
      } else {
        navigateWithTransition(() => router.push(`/audit?step=${stepIndex + 1}`));
      }
    });
  }

  function handleBack() {
    if (stepIndex <= 1) return;
    navigateWithTransition(() => router.push(`/audit?step=${stepIndex - 1}`));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <ProgressBar current={stepIndex} total={totalSteps} />

      <div className="mt-8 flex-1">
        <h1 className="font-heading text-2xl text-ink">{area.name}</h1>
        <p className="mt-2 text-base text-ink-soft">{area.description}</p>

        <section className="mt-8">
          <h2 className="mb-3 text-base font-medium text-ink">How is this area right now?</h2>
          <RatingScale
            min={1}
            max={10}
            value={satisfaction}
            onChange={handleSatisfaction}
            variant="grid"
            name={`${area.name} — how it is right now`}
          />
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="mb-3 text-base font-medium text-ink">How much does this area matter to you?</h2>
          <RatingScale
            min={1}
            max={5}
            value={importance}
            onChange={handleImportance}
            variant="pills"
            name={`${area.name} — how much it matters`}
          />
        </section>

        <div className="mt-10">
          <TextAreaField
            id="note"
            label="Anything you want to add?"
            optional
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Optional — a sentence or two is plenty"
          />
        </div>

        {status === "error" && errorMessage && (
          <div className="mt-4">
            <Notice tone="error">{errorMessage}</Notice>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={handleBack} disabled={stepIndex <= 1}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} loading={isPending}>
          {stepIndex >= totalSteps ? "Continue to leverage question" : "Continue"}
        </Button>
      </div>
    </main>
  );
}
