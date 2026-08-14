"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeverageArea } from "@/app/actions/audit";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Logo } from "@/components/ui/Logo";

type Recommended = { lifeAreaId: string; lifeAreaName: string; rationale: string } | null;

export function LeverageClient({
  auditId,
  lifeAreas,
  selectedAreaId,
  recommended,
}: {
  auditId: string;
  lifeAreas: { id: string; name: string }[];
  selectedAreaId: string | null;
  recommended: Recommended;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(selectedAreaId);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isContinuing, startContinuing] = useTransition();

  function handleSelect(id: string) {
    setSelected(id);
    setError(null);
    startSaving(async () => {
      const result = await setLeverageArea({ auditId, lifeAreaId: id });
      if (!result.ok) setError(result.message);
    });
  }

  function handleContinue() {
    if (!selected) return;
    startContinuing(async () => {
      const result = await setLeverageArea({ auditId, lifeAreaId: selected });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/audit/complete");
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <p className="label-caps text-sm text-gold">One more question</p>
      <h1 className="mt-3 font-heading text-2xl text-ink">
        If one of these improved, which would help the others most?
      </h1>
      <p className="mt-2 text-base text-ink-soft">
        Pick one. This is the single most useful signal your coach gets.
      </p>

      {recommended && (
        <div className="mt-6 rounded-lg border border-gold bg-gold-soft p-5">
          <p className="label-caps text-xs text-gold-strong">Your recommended focus</p>
          <p className="mt-1 font-heading text-lg text-ink">{recommended.lifeAreaName}</p>
          <p className="mt-2 text-sm leading-snug text-ink-soft">{recommended.rationale}</p>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => handleSelect(recommended.lifeAreaId)}
              loading={isSaving && selected === recommended.lifeAreaId}
            >
              Use this focus
            </Button>
          </div>
        </div>
      )}

      <p className="mt-8 text-sm font-medium text-ink-soft">
        {recommended ? "Or choose another area" : "Choose an area"}
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {lifeAreas.map((area) => {
          const isSelected = selected === area.id;
          return (
            <button
              key={area.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(area.id)}
              className={`flex min-h-[var(--tap-target-min)] items-center gap-3 rounded-md border px-4 text-left text-base transition-colors duration-[var(--duration-fast)] ${
                isSelected
                  ? "border-gold bg-gold-soft text-ink"
                  : "border-border bg-paper-raised text-ink hover:border-gold"
              }`}
            >
              {/*
                A plain radio-style dot, not tied to the area's name or
                content in any way — deliberately not a per-area icon or
                letter badge, since those would have to be derived from the
                (database-managed, renameable) area name and would break the
                moment two areas start with the same letter or Duane
                reorders/renames content.
              */}
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-gold" : "border-border-strong"
                }`}
              >
                {isSelected && <span className="h-3 w-3 rounded-full bg-gold" />}
              </span>
              {area.name}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="mt-10 flex justify-end">
        <Button onClick={handleContinue} disabled={!selected} loading={isContinuing || isSaving}>
          Continue
        </Button>
      </div>
    </main>
  );
}
