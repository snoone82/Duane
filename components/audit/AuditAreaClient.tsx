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

type LifeArea = { id: string; name: string; description: string };

type SaveStatus = "idle" | "saving" | "saved" | "error";

type ExistingResponse = {
  satisfactionScore: number;
  importanceScore: number;
  whyThisScore: string | null;
  whatsWorking: string | null;
  whatsNotWorking: string | null;
  nextPointMove: string | null;
};

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
  existingResponse: ExistingResponse | null;
}) {
  const router = useRouter();
  const [satisfaction, setSatisfaction] = useState<number | null>(
    existingResponse?.satisfactionScore ?? null
  );
  const [importance, setImportance] = useState<number | null>(
    existingResponse?.importanceScore ?? null
  );

  // Four optional reflection fields — see the comment on saveAuditResponse
  // in app/actions/audit.ts for why these exist and why they're optional.
  const [whyThisScore, setWhyThisScore] = useState(existingResponse?.whyThisScore ?? "");
  const [whatsWorking, setWhatsWorking] = useState(existingResponse?.whatsWorking ?? "");
  const [whatsNotWorking, setWhatsNotWorking] = useState(existingResponse?.whatsNotWorking ?? "");
  const [nextPointMove, setNextPointMove] = useState(existingResponse?.nextPointMove ?? "");

  const hasExistingDetail = Boolean(
    existingResponse?.whyThisScore ||
      existingResponse?.whatsWorking ||
      existingResponse?.whatsNotWorking ||
      existingResponse?.nextPointMove
  );
  const [detailsOpen, setDetailsOpen] = useState(hasExistingDetail);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const detailDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when the area changes (navigating back/forward).
  useEffect(() => {
    setSatisfaction(existingResponse?.satisfactionScore ?? null);
    setImportance(existingResponse?.importanceScore ?? null);
    setWhyThisScore(existingResponse?.whyThisScore ?? "");
    setWhatsWorking(existingResponse?.whatsWorking ?? "");
    setWhatsNotWorking(existingResponse?.whatsNotWorking ?? "");
    setNextPointMove(existingResponse?.nextPointMove ?? "");
    setDetailsOpen(
      Boolean(
        existingResponse?.whyThisScore ||
          existingResponse?.whatsWorking ||
          existingResponse?.whatsNotWorking ||
          existingResponse?.nextPointMove
      )
    );
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
      whyThisScore,
      whatsWorking,
      whatsNotWorking,
      nextPointMove,
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

  function handleDetailChange(setter: (value: string) => void, value: string) {
    setter(value);
    if (satisfaction == null || importance == null) return;
    if (detailDebounce.current) clearTimeout(detailDebounce.current);
    detailDebounce.current = setTimeout(() => void save(), 600);
  }

  const canContinue = satisfaction != null && importance != null;

  function handleContinue() {
    startTransition(async () => {
      const result = await save();
      if (!result.ok) return;

      if (stepIndex >= totalSteps) {
        router.push("/audit/leverage");
      } else {
        router.push(`/audit?step=${stepIndex + 1}`);
      }
    });
  }

  function handleBack() {
    if (stepIndex <= 1) return;
    router.push(`/audit?step=${stepIndex - 1}`);
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

        <div className="mt-10 border-t border-border pt-8">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls="audit-area-detail"
            className="flex min-h-[var(--tap-target-min)] w-full items-center justify-between rounded-md border border-border bg-paper-muted px-4 text-sm font-medium text-ink-soft"
          >
            <span>Add more detail</span>
            <span className="text-ink-faint" aria-hidden="true">
              {detailsOpen ? "−" : "+"}
            </span>
          </button>

          {detailsOpen && (
            <div id="audit-area-detail" className="mt-6 flex flex-col gap-5">
              <TextAreaField
                id="whyThisScore"
                label="Why did you give yourself this score?"
                optional
                value={whyThisScore}
                onChange={(e) => handleDetailChange(setWhyThisScore, e.target.value)}
              />
              <TextAreaField
                id="whatsWorking"
                label="What's currently working?"
                optional
                value={whatsWorking}
                onChange={(e) => handleDetailChange(setWhatsWorking, e.target.value)}
              />
              <TextAreaField
                id="whatsNotWorking"
                label="What's not currently working?"
                optional
                value={whatsNotWorking}
                onChange={(e) => handleDetailChange(setWhatsNotWorking, e.target.value)}
              />
              <TextAreaField
                id="nextPointMove"
                label="What would move this forward by one point?"
                optional
                value={nextPointMove}
                onChange={(e) => handleDetailChange(setNextPointMove, e.target.value)}
              />
            </div>
          )}
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
