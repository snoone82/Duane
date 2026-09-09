"use client";

// The client's service tier (Duane). Not cosmetic: this is what will
// eventually decide which parts of PBOS the client can operate, so it is
// deliberately a single explicit choice rather than inferred from a package
// name or a retainer amount.
//
// pbos_engagements.tier records what was *sold*; this records what the
// system actually runs them as. They will usually agree, and where they
// don't, this one wins — a client mid-migration between tiers should get the
// experience they're being operated under, not the one on the contract.
import { useState, useTransition } from "react";
import { Select, Label } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { updateClientField } from "@/lib/actions/clients";
import { PBOS_TIERS, pbosTierMeta, pbosTierNumber } from "@/lib/status";

export function ClientTierCard({ clientId, tier }: { clientId: string; tier: string }) {
  const [current, setCurrent] = useState(tier);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Service tier</h2>
        <StatusPill label={pbosTierNumber(current)} color={pbosTierMeta(current).color} />
      </div>
      <Label htmlFor="client-tier">Operated as</Label>
      <Select
        id="client-tier"
        value={current}
        disabled={isSaving}
        onChange={(event) => {
          const next = event.target.value;
          setCurrent(next);
          setError(null);
          startSaving(async () => {
            const result = await updateClientField(clientId, "tier", next);
            if (!result.ok) {
              setError(result.message);
              setCurrent(tier);
            }
          });
        }}
      >
        {PBOS_TIERS.map((option) => (
          <option key={option.value} value={option.value}>
            Tier {option.rank} · {option.label}
          </option>
        ))}
      </Select>
      <p className="mt-1.5 text-xs text-ink-soft">
        Tier 1 is the most self-directed; Tier 4 is the most done-for-you. Shown to the client in preview mode, and will
        drive what they can operate.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  );
}
