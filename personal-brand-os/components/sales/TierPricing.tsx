"use client";

import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { updateTierDefault } from "@/lib/actions/pbos-sales";
import { formatCurrency } from "@/lib/format";
import type { TierOption } from "@/components/sales/shared";

/** The four tiers and what they cost by default. Deliberately data, not code:
 * every deal stores its own agreed figures, so changing a default here prices
 * the next deal and never rewrites one already done. */
export function TierPricing({ tiers, canEdit }: { tiers: TierOption[]; canEdit: boolean }) {
  return (
    <div className="space-y-3">
      {tiers.map((tier, index) => (
        <div key={tier.key} className="border-b border-border pb-3 last:border-0 last:pb-0">
          <p className="text-sm font-medium text-ink">
            <span className="text-ink-faint">Tier {index + 1}</span> · {tier.name}
          </p>
          <p className="mt-0.5 text-xs italic text-ink-soft">&ldquo;{tier.promise}&rdquo;</p>
          {canEdit ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <AutosaveInput
                id={`tier-setup-${tier.key}`}
                label="Default setup fee (£)"
                type="number"
                initialValue={tier.defaultSetupFee?.toString() ?? ""}
                onSave={(value) => updateTierDefault(tier.key, "default_setup_fee", value)}
                placeholder="Not set"
              />
              <AutosaveInput
                id={`tier-monthly-${tier.key}`}
                label="Default monthly fee (£)"
                type="number"
                initialValue={tier.defaultMonthlyFee?.toString() ?? ""}
                onSave={(value) => updateTierDefault(tier.key, "default_monthly_fee", value)}
                placeholder="Not set"
              />
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">
              {tier.defaultMonthlyFee ? `${formatCurrency(tier.defaultMonthlyFee)}/month` : "Pricing not set"}
              {tier.defaultSetupFee ? ` · ${formatCurrency(tier.defaultSetupFee)} setup` : ""}
            </p>
          )}
        </div>
      ))}
      <p className="text-xs text-ink-faint">
        Defaults only — they prefill a new deal and nothing more. Pricing can change here whenever you want without touching a
        deal or an engagement that already exists.
      </p>
    </div>
  );
}
