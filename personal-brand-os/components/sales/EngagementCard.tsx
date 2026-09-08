"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { updateEngagementField, setEngagementStatus } from "@/lib/actions/pbos-sales";
import { ENGAGEMENT_STATUS, engagementStatusMeta, pbosTierMeta } from "@/lib/status";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import type { TierOption } from "@/components/sales/shared";

type Engagement = Database["public"]["Tables"]["pbos_engagements"]["Row"];

/** What a won client is actually on. Expected MRR is what the deal said;
 * actual MRR is what is really recurring — the gap between them is the
 * number worth watching, so both are shown side by side rather than one
 * quietly standing in for the other. */
export function EngagementCard({
  engagement,
  clientName,
  tiers,
}: {
  engagement: Engagement;
  clientName: string;
  tiers: TierOption[];
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusMeta = engagementStatusMeta(engagement.status);
  const tierMeta = pbosTierMeta(engagement.tier);
  const mrr = engagement.actual_mrr ?? engagement.expected_mrr ?? 0;
  const isLive = engagement.status === "onboarding" || engagement.status === "active";
  const save = (field: Parameters<typeof updateEngagementField>[1]) => (value: string) =>
    updateEngagementField(engagement.client_id, field, value);

  return (
    <details className="group rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{clientName}</span>
            <StatusPill label={tierMeta.label} color={tierMeta.color} />
          </span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {isLive ? `${formatCurrency(mrr)}/mo` : "Not billing"}
            {engagement.actual_mrr === null && isLive && <span className="text-warning"> · expected, not confirmed</span>}
            {engagement.contract_start_date && ` · started ${formatDate(engagement.contract_start_date)}`}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <StatusPill label={statusMeta.label} color={statusMeta.color} />
          <span aria-hidden className="text-xs text-ink-faint transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-4">
        {error && <Notice kind="danger">{error}</Notice>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <Label htmlFor={`eng-status-${engagement.client_id}`}>Engagement</Label>
            <Select
              id={`eng-status-${engagement.client_id}`}
              value={engagement.status}
              disabled={isBusy}
              onChange={(e) =>
                startTransition(async () => {
                  setError(null);
                  const result = await setEngagementStatus(engagement.client_id, e.target.value);
                  if (!result.ok) setError(result.message);
                })
              }
            >
              {ENGAGEMENT_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-40">
            <Label htmlFor={`eng-tier-${engagement.client_id}`}>Tier</Label>
            <Select
              id={`eng-tier-${engagement.client_id}`}
              defaultValue={engagement.tier}
              disabled={isBusy}
              onChange={(e) =>
                startTransition(async () => {
                  const result = await updateEngagementField(engagement.client_id, "tier", e.target.value);
                  if (!result.ok) setError(result.message);
                })
              }
            >
              {tiers.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="mb-2 text-xs text-ink-faint">
            Moving to Paused or Ended takes them out of MRR and updates the client record too.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AutosaveInput id={`eng-monthly-${engagement.client_id}`} label="Monthly recurring fee (£)" type="number" initialValue={engagement.monthly_fee?.toString() ?? ""} onSave={save("monthly_fee")} />
          <AutosaveInput id={`eng-extras-${engagement.client_id}`} label="Optional extras" initialValue={engagement.extras} onSave={save("extras")} />
          <AutosaveInput id={`eng-extras-value-${engagement.client_id}`} label="Extras (£ per month)" type="number" initialValue={engagement.extras_monthly_value?.toString() ?? ""} onSave={save("extras_monthly_value")} />
          <AutosaveInput id={`eng-actual-${engagement.client_id}`} label="Actual recurring revenue (£)" type="number" initialValue={engagement.actual_mrr?.toString() ?? ""} onSave={save("actual_mrr")} placeholder={engagement.expected_mrr?.toString() ?? ""} />
          <AutosaveInput id={`eng-setup-${engagement.client_id}`} label="Setup / onboarding fee (£)" type="number" initialValue={engagement.setup_fee?.toString() ?? ""} onSave={save("setup_fee")} />
          <AutosaveInput id={`eng-setup-invoiced-${engagement.client_id}`} label="Setup fee invoiced on" type="date" initialValue={engagement.setup_fee_invoiced_on ?? ""} onSave={save("setup_fee_invoiced_on")} />
          <AutosaveInput id={`eng-start-${engagement.client_id}`} label="Contract start" type="date" initialValue={engagement.contract_start_date ?? ""} onSave={save("contract_start_date")} />
          <AutosaveInput id={`eng-term-${engagement.client_id}`} label="Term (months)" type="number" initialValue={engagement.contract_term_months?.toString() ?? ""} onSave={save("contract_term_months")} />
        </div>
        <p className="text-xs text-ink-faint">
          Expected {formatCurrency(engagement.expected_mrr)}/mo from the agreed terms
          {engagement.actual_mrr !== null
            ? ` · actual ${formatCurrency(engagement.actual_mrr)}/mo`
            : " · actual not confirmed yet, so MRR uses the expected figure"}
          . The setup fee counts towards the month you invoice it in.
        </p>

        <AutosaveTextarea id={`eng-notes-${engagement.client_id}`} label="Notes" initialValue={engagement.notes} onSave={save("notes")} rows={2} />

        <div className="border-t border-border pt-2 text-xs">
          <Link href={`/clients/${engagement.client_id}/overview`} className="text-accent underline-offset-2 hover:underline">
            Open {clientName}&rsquo;s client record →
          </Link>
        </div>
      </div>
    </details>
  );
}
