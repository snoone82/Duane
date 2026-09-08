"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { LeadActions } from "@/components/sales/LeadActions";
import { updateOpportunityField, setOpportunityStage, deleteOpportunity } from "@/lib/actions/pbos-sales";
import { PBOS_STAGES, pbosStageMeta, pbosTierMeta } from "@/lib/status";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import type { LeadActionRow, TeamOwner, TierOption } from "@/components/sales/shared";

type Deal = Database["public"]["Tables"]["pbos_opportunities"]["Row"];

/** One PBOS deal: which tier, on what terms, and how close it is. Marking it
 * Won is the single moment a lead becomes a client. */
export function DealCard({
  deal,
  leadName,
  leadCompany,
  convertedClientId,
  actions,
  team,
  tiers,
}: {
  deal: Deal;
  leadName: string;
  leadCompany: string;
  convertedClientId: string | null;
  actions: LeadActionRow[];
  team: TeamOwner[];
  tiers: TierOption[];
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stageMeta = pbosStageMeta(deal.stage);
  const tierMeta = pbosTierMeta(deal.tier);
  const isClosed = deal.stage === "won" || deal.stage === "lost";
  const nextAction = actions.find((a) => a.status !== "completed");

  const save = (field: Parameters<typeof updateOpportunityField>[1]) => (value: string) =>
    updateOpportunityField(deal.id, field, value);

  function changeStage(stage: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setOpportunityStage(deal.id, stage);
      if (!result.ok) setError(result.message);
      else if (result.data) setNotice(result.data);
    });
  }

  const history = Array.isArray(deal.stage_history) ? (deal.stage_history as { stage: string; at: string }[]) : [];
  const timeline = [...history]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  // Day-one value: the one-off setup plus the first month of recurring. Never
  // annualised — a 12-month multiple on one Partner deal would swamp every
  // other number on the page.
  const dealValue = (deal.setup_fee ?? 0) + (deal.expected_mrr ?? 0);

  return (
    <details className="group rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{leadName}</span>
            {leadCompany && <span className="text-sm text-ink-soft">· {leadCompany}</span>}
            <StatusPill label={tierMeta.label} color={tierMeta.color} />
          </span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {deal.expected_mrr ? `${formatCurrency(deal.expected_mrr)}/mo` : "No monthly fee set"}
            {deal.setup_fee ? ` · ${formatCurrency(deal.setup_fee)} setup` : ""}
            {" · "}
            {deal.probability}% likely
            {deal.expected_close && ` · closes ${formatDate(deal.expected_close)}`}
            {nextAction && <span> · next: {nextAction.title}</span>}
            {!nextAction && !isClosed && <span className="text-warning"> · no next action set</span>}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <StatusPill label={stageMeta.label} color={stageMeta.color} />
          <span aria-hidden className="text-xs text-ink-faint transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-4">
        {notice && <Notice kind="success">{notice}</Notice>}
        {error && <Notice kind="danger">{error}</Notice>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <Label htmlFor={`deal-stage-${deal.id}`}>Stage</Label>
            <Select
              id={`deal-stage-${deal.id}`}
              value={deal.stage}
              disabled={isBusy || deal.stage === "won"}
              onChange={(e) => changeStage(e.target.value)}
            >
              {PBOS_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-40">
            <Label htmlFor={`deal-tier-select-${deal.id}`}>Tier</Label>
            <Select
              id={`deal-tier-select-${deal.id}`}
              defaultValue={deal.tier}
              disabled={isBusy || isClosed}
              onChange={(e) =>
                startTransition(async () => {
                  const result = await updateOpportunityField(deal.id, "tier", e.target.value);
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
          {deal.stage === "won" && convertedClientId ? (
            <p className="mb-2 text-xs text-success">
              Won —{" "}
              <Link href={`/clients/${convertedClientId}/overview`} className="underline underline-offset-2">
                client record created, onboarding required →
              </Link>
            </p>
          ) : (
            <p className="mb-2 text-xs text-ink-faint">
              Marking <span className="text-success">Won</span> creates the client record and starts onboarding. It doesn&rsquo;t
              onboard them &mdash; that&rsquo;s yours to run.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Commercial terms</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AutosaveInput id={`deal-title-edit-${deal.id}`} label="Deal name" initialValue={deal.title} onSave={save("title")} />
            <AutosaveInput id={`deal-contact-${deal.id}`} label="Contact" initialValue={deal.contact_name} onSave={save("contact_name")} />
            <AutosaveInput id={`deal-source-edit-${deal.id}`} label="Source" initialValue={deal.source} onSave={save("source")} />
            <AutosaveInput id={`deal-setup-edit-${deal.id}`} label="Setup / onboarding fee (£)" type="number" initialValue={deal.setup_fee?.toString() ?? ""} onSave={save("setup_fee")} />
            <AutosaveInput id={`deal-monthly-edit-${deal.id}`} label="Monthly recurring fee (£)" type="number" initialValue={deal.monthly_fee?.toString() ?? ""} onSave={save("monthly_fee")} />
            <AutosaveInput id={`deal-extras-edit-${deal.id}`} label="Optional extras" initialValue={deal.extras} onSave={save("extras")} />
            <AutosaveInput id={`deal-extras-value-edit-${deal.id}`} label="Extras (£ per month)" type="number" initialValue={deal.extras_monthly_value?.toString() ?? ""} onSave={save("extras_monthly_value")} />
            <AutosaveInput id={`deal-start-edit-${deal.id}`} label="Contract start" type="date" initialValue={deal.contract_start_date ?? ""} onSave={save("contract_start_date")} />
            <AutosaveInput id={`deal-term-edit-${deal.id}`} label="Term (months)" type="number" initialValue={deal.contract_term_months?.toString() ?? ""} onSave={save("contract_term_months")} />
            <AutosaveInput id={`deal-prob-edit-${deal.id}`} label="Probability %" type="number" initialValue={String(deal.probability)} onSave={save("probability")} />
            <AutosaveInput id={`deal-close-edit-${deal.id}`} label="Expected close" type="date" initialValue={deal.expected_close ?? ""} onSave={save("expected_close")} />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Expected MRR <span className="tabular-nums text-ink-soft">{formatCurrency(deal.expected_mrr)}</span> — the monthly fee
            plus recurring extras, worked out for you. Day-one value {formatCurrency(dealValue)} (setup + first month).
          </p>
        </div>

        <AutosaveTextarea id={`deal-notes-edit-${deal.id}`} label="Notes" initialValue={deal.notes} onSave={save("notes")} rows={2} />
        {deal.stage === "lost" && (
          <AutosaveTextarea id={`deal-lost-${deal.id}`} label="Why it was lost" initialValue={deal.lost_reason} onSave={save("lost_reason")} rows={2} />
        )}

        {!isClosed && <LeadActions leadId={deal.lead_id} opportunityId={deal.id} actions={actions} team={team} />}

        {timeline.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">Timeline</p>
            <ul className="space-y-1">
              {timeline.map((item, index) => (
                <li key={index} className="text-xs">
                  <span className="text-ink-soft">Stage → {pbosStageMeta(item.stage).label}</span>
                  <span className="ml-2 text-ink-faint">{formatDate(item.at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {deal.stage !== "won" && (
          <div className="flex justify-end border-t border-border pt-2">
            <button
              type="button"
              disabled={isBusy}
              className="text-xs text-ink-faint hover:text-danger"
              onClick={() => {
                if (!window.confirm(`Delete the "${deal.title}" deal for ${leadName}? Its history goes with it.`)) return;
                startTransition(async () => {
                  const result = await deleteOpportunity(deal.id);
                  if (!result.ok) setError(result.message);
                });
              }}
            >
              Delete deal
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
