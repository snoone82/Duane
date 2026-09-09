"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { LeadActions } from "@/components/sales/LeadActions";
import {
  updateLeadField,
  setLeadStatus,
  deleteLead,
  createOpportunity,
} from "@/lib/actions/pbos-sales";
import { PBOS_LEAD_STATUS, pbosLeadStatusMeta, pbosTierMeta } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import type { LeadActionRow, TeamOwner, TierOption } from "@/components/sales/shared";

type Lead = Database["public"]["Tables"]["pbos_leads"]["Row"];

/** A lead is a person who might buy PBOS. They have no client record, no
 * delivery tabs and no portal — winning a deal is what creates all of that. */
export function LeadCard({
  lead,
  openDeals,
  actions,
  team,
  tiers,
}: {
  lead: Lead;
  openDeals: number;
  actions: LeadActionRow[];
  team: TeamOwner[];
  tiers: TierOption[];
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealState, dealFormAction, dealPending] = useActionState(createOpportunity, null);
  const [tierKey, setTierKey] = useState(lead.tier_interest ?? "");

  useEffect(() => {
    if (dealState?.ok) setShowDealForm(false);
  }, [dealState]);

  const statusMeta = pbosLeadStatusMeta(lead.status);
  const tier = tiers.find((t) => t.key === tierKey);
  const save = (field: "name" | "company" | "job_title" | "email" | "phone" | "linkedin_url" | "website_url" | "source" | "notes") =>
    (value: string) => updateLeadField(lead.id, field, value);

  return (
    <details className="group rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{lead.name}</span>
            {lead.company && <span className="text-sm text-ink-soft">· {lead.company}</span>}
            {lead.tier_interest && <StatusPill label={pbosTierMeta(lead.tier_interest).label} color={pbosTierMeta(lead.tier_interest).color} />}
          </span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {openDeals > 0 ? `${openDeals} open deal${openDeals === 1 ? "" : "s"}` : "No deal yet"}
            {lead.source && ` · ${lead.source}`}
            {lead.converted_at && ` · became a client ${formatDate(lead.converted_at.slice(0, 10))}`}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <StatusPill label={statusMeta.label} color={statusMeta.color} />
          <span aria-hidden className="text-xs text-ink-faint transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-4">
        {error && <Notice kind="danger">{error}</Notice>}

        {lead.converted_client_id ? (
          <Notice kind="success">
            Won — now a client.{" "}
            <Link href={`/clients/${lead.converted_client_id}/overview`} className="underline underline-offset-2">
              Open their client record →
            </Link>
          </Notice>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40">
              <Label htmlFor={`lead-status-${lead.id}`}>Lead status</Label>
              <Select
                id={`lead-status-${lead.id}`}
                value={lead.status}
                disabled={isBusy}
                onChange={(e) =>
                  startTransition(async () => {
                    setError(null);
                    const result = await setLeadStatus(lead.id, e.target.value);
                    if (!result.ok) setError(result.message);
                  })
                }
              >
                {PBOS_LEAD_STATUS.filter((s) => s.value !== "won").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-40">
              <Label htmlFor={`lead-tier-${lead.id}`}>Tier they&rsquo;re likely for</Label>
              <Select
                id={`lead-tier-${lead.id}`}
                defaultValue={lead.tier_interest ?? ""}
                disabled={isBusy}
                onChange={(e) =>
                  startTransition(async () => {
                    setError(null);
                    const result = await updateLeadField(lead.id, "tier_interest", e.target.value);
                    if (!result.ok) setError(result.message);
                  })
                }
              >
                <option value="">Not decided</option>
                {tiers.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <p className="mb-2 text-xs text-ink-faint">A lead is not a client. Winning a deal creates the client record.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AutosaveInput id={`lead-name-${lead.id}`} label="Name" initialValue={lead.name} onSave={save("name")} />
          <AutosaveInput id={`lead-company-${lead.id}`} label="Company" initialValue={lead.company} onSave={save("company")} />
          <AutosaveInput id={`lead-role-${lead.id}`} label="Job title" initialValue={lead.job_title} onSave={save("job_title")} />
          <AutosaveInput id={`lead-email-${lead.id}`} label="Email" type="email" initialValue={lead.email} onSave={save("email")} />
          <AutosaveInput id={`lead-phone-${lead.id}`} label="Phone" initialValue={lead.phone} onSave={save("phone")} />
          <AutosaveInput id={`lead-source-${lead.id}`} label="Source" initialValue={lead.source} onSave={save("source")} placeholder="Referral, LinkedIn, event…" />
          <AutosaveInput id={`lead-linkedin-${lead.id}`} label="LinkedIn" initialValue={lead.linkedin_url} onSave={save("linkedin_url")} />
          <AutosaveInput id={`lead-website-${lead.id}`} label="Website" initialValue={lead.website_url} onSave={save("website_url")} />
        </div>
        <AutosaveTextarea id={`lead-notes-${lead.id}`} label="Notes" initialValue={lead.notes} onSave={save("notes")} rows={2} />

        <LeadActions leadId={lead.id} actions={actions} team={team} />

        {!lead.converted_client_id && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setShowDealForm((v) => !v)}>
              + Add a deal for {lead.name}
            </Button>
            {showDealForm && (
              <form
                action={(formData) => {
                  formData.set("lead_id", lead.id);
                  dealFormAction(formData);
                }}
                className="mt-3 space-y-3 rounded-md border border-border p-3"
              >
                {dealState && !dealState.ok && <Notice kind="danger">{dealState.message}</Notice>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`deal-tier-${lead.id}`}>Tier</Label>
                    <Select id={`deal-tier-${lead.id}`} name="tier" required value={tierKey} onChange={(e) => setTierKey(e.target.value)}>
                      <option value="" disabled>
                        Choose a tier…
                      </option>
                      {tiers.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                    {tier?.promise && <p className="mt-1 text-xs italic text-ink-faint">&ldquo;{tier.promise}&rdquo;</p>}
                  </div>
                  <div>
                    <Label htmlFor={`deal-title-${lead.id}`}>Deal name</Label>
                    <Input
                      id={`deal-title-${lead.id}`}
                      name="title"
                      required
                      autoComplete="off"
                      defaultValue={tier ? `PBOS ${tier.name}` : ""}
                      key={tierKey}
                      placeholder="e.g. PBOS Managed"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`deal-setup-${lead.id}`}>Setup / onboarding fee (£)</Label>
                    <Input id={`deal-setup-${lead.id}`} name="setup_fee" type="number" min="0" step="1" defaultValue={tier?.defaultSetupFee ?? ""} key={`setup-${tierKey}`} />
                  </div>
                  <div>
                    <Label htmlFor={`deal-monthly-${lead.id}`}>Monthly recurring fee (£)</Label>
                    <Input id={`deal-monthly-${lead.id}`} name="monthly_fee" type="number" min="0" step="1" defaultValue={tier?.defaultMonthlyFee ?? ""} key={`monthly-${tierKey}`} />
                  </div>
                  <div>
                    <Label htmlFor={`deal-extras-${lead.id}`}>Optional extras</Label>
                    <Input id={`deal-extras-${lead.id}`} name="extras" autoComplete="off" placeholder="e.g. extra 4 videos/month" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-extras-value-${lead.id}`}>Extras (£ per month)</Label>
                    <Input id={`deal-extras-value-${lead.id}`} name="extras_monthly_value" type="number" min="0" step="1" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-start-${lead.id}`}>Contract start</Label>
                    <Input id={`deal-start-${lead.id}`} name="contract_start_date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-term-${lead.id}`}>Term (months)</Label>
                    <Input id={`deal-term-${lead.id}`} name="contract_term_months" type="number" min="1" step="1" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-prob-${lead.id}`}>Probability %</Label>
                    <Input id={`deal-prob-${lead.id}`} name="probability" type="number" min="0" max="100" defaultValue="50" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-close-${lead.id}`}>Expected close</Label>
                    <Input id={`deal-close-${lead.id}`} name="expected_close" type="date" />
                  </div>
                  <div>
                    <Label htmlFor={`deal-owner-${lead.id}`}>Owner</Label>
                    <Select id={`deal-owner-${lead.id}`} name="owner" defaultValue="">
                      <option value="">Me</option>
                      {team.map((member) => (
                        <option key={member.id} value={`u:${member.id}`}>
                          {member.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor={`deal-notes-${lead.id}`}>Notes</Label>
                  <Textarea id={`deal-notes-${lead.id}`} name="notes" rows={2} />
                </div>
                <p className="text-xs text-ink-faint">
                  Every figure is optional — leave the fees blank until they&rsquo;re agreed and the deal still tracks.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowDealForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={dealPending}>
                    {dealPending ? "Creating…" : "Create deal"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {!lead.converted_client_id && (
          <div className="flex justify-end border-t border-border pt-2">
            <button
              type="button"
              disabled={isBusy}
              className="text-xs text-ink-faint hover:text-danger"
              onClick={() => {
                if (!window.confirm(`Delete ${lead.name}? Their deals and next actions go too.`)) return;
                startTransition(async () => {
                  const result = await deleteLead(lead.id);
                  if (!result.ok) setError(result.message);
                });
              }}
            >
              Delete lead
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
