"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/Button";
import {
  updateMonthlyPlanField,
  updateMonthlyPlanStatus,
  refreshMonthlyPlanSnapshot,
  deleteMonthlyPlan,
  type MonthlyPlanSnapshot,
} from "@/lib/actions/monthly-plans";
import { MONTHLY_PLAN_STATUS, type MonthlyPlanStatus } from "@/lib/status";
import type { Database } from "@/lib/database.types";

type Plan = Database["public"]["Tables"]["monthly_plans"]["Row"];

export function ClientSnapshotPanel({ clientId, plan }: { clientId: string; plan: Plan }) {
  const snapshot = (plan.snapshot ?? {}) as unknown as MonthlyPlanSnapshot;
  const [isRefreshing, startRefresh] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const save = (
    field:
      | "primary_objective"
      | "secondary_objectives"
      | "global_tone_notes"
      | "preferred_language"
      | "avoid_language"
      | "cta_priorities"
      | "primary_cta_destination"
      | "scope_status"
  ) => (value: string) => updateMonthlyPlanField(clientId, plan.id, field, value);

  function handleRefresh() {
    startRefresh(async () => {
      const result = await refreshMonthlyPlanSnapshot(clientId, plan.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this Monthly Plan? Master Content and Platform Outputs created inside it are kept, unlinked from any plan. This can't be undone.")) return;
    startDelete(async () => {
      const result = await deleteMonthlyPlan(clientId, plan.id);
      if (!result.ok) setError(result.message);
      else router.push(`/clients/${clientId}/plans`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusSelect
          value={plan.status as MonthlyPlanStatus}
          options={MONTHLY_PLAN_STATUS}
          ariaLabel="Plan status"
          onChange={(value) => updateMonthlyPlanStatus(clientId, plan.id, value)}
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh auto-pulled data"}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete plan"}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">This month&rsquo;s synthesis</h3>
        <div className="space-y-3">
          <AutosaveTextarea id={`plan-obj-${plan.id}`} label="Primary objective" initialValue={plan.primary_objective} onSave={save("primary_objective")} rows={2} />
          <AutosaveTextarea id={`plan-secobj-${plan.id}`} label="Secondary objectives" initialValue={plan.secondary_objectives} onSave={save("secondary_objectives")} rows={2} />
          <AutosaveTextarea id={`plan-tone-${plan.id}`} label="Tone / voice notes" initialValue={plan.global_tone_notes} onSave={save("global_tone_notes")} rows={2} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AutosaveInput id={`plan-preflang-${plan.id}`} label="Preferred language" initialValue={plan.preferred_language} onSave={save("preferred_language")} />
            <AutosaveInput id={`plan-avoid-${plan.id}`} label="Avoid" initialValue={plan.avoid_language} onSave={save("avoid_language")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AutosaveInput id={`plan-ctapri-${plan.id}`} label="CTA priorities" initialValue={plan.cta_priorities} onSave={save("cta_priorities")} />
            <AutosaveInput id={`plan-ctadest-${plan.id}`} label="Primary CTA destination" initialValue={plan.primary_cta_destination} onSave={save("primary_cta_destination")} />
          </div>
          <AutosaveTextarea id={`plan-scope-${plan.id}`} label="Scope / status notes" initialValue={plan.scope_status} onSave={save("scope_status")} rows={2} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Auto-pulled from the client profile · frozen at creation
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-surface-muted/30 p-3">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Audiences</p>
            {snapshot.audiences?.length ? (
              <ul className="space-y-1 text-xs text-ink-faint">
                {snapshot.audiences.map((a, i) => (
                  <li key={i}>
                    <span className="text-ink-soft">{a.name}</span>
                    {a.description ? ` — ${a.description}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-faint">None captured yet.</p>
            )}
          </div>
          <div className="rounded-md border border-border bg-surface-muted/30 p-3">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Content pillars</p>
            {snapshot.pillars?.length ? (
              <ul className="space-y-1 text-xs text-ink-faint">
                {snapshot.pillars.map((p, i) => (
                  <li key={i}>
                    <span className="text-ink-soft">{p.name}</span>
                    {p.description ? ` — ${p.description}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-faint">None captured yet.</p>
            )}
          </div>
          <div className="rounded-md border border-border bg-surface-muted/30 p-3">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Platform cadence &amp; rules</p>
            {snapshot.platforms?.length ? (
              <ul className="space-y-1 text-xs text-ink-faint">
                {snapshot.platforms.map((p, i) => (
                  <li key={i}>
                    <span className="text-ink-soft">{p.account_name ? `${p.platform} — ${p.account_name}` : p.platform}</span>
                    {p.cadence_target ? ` — ${p.cadence_target}/${p.cadence_period ?? "period"}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-faint">None captured yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
