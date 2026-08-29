"use client";

import { useState } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Label, Select } from "@/components/ui/Input";
import { setSocialCadence, setSocialAudienceLink, updateSocialStrategyField } from "@/lib/actions/social";
import { PLATFORM_ROLES, CROSS_POST_RULES, CADENCE_PERIODS, crossPostRuleMeta } from "@/lib/platform-strategy";
import type { Database } from "@/lib/database.types";

type SocialStrategy = Database["public"]["Tables"]["social_strategies"]["Row"];

export interface AudienceOption {
  id: string;
  name: string;
}

/**
 * The Platform Strategy Profile (Duane's brief): the fields that tell PBOS
 * HOW a platform should be used, not just where the account is. These drive
 * the importer's platform-mix proposal, the AI's per-platform writing and the
 * planned-vs-target cadence view — so this panel is the input for all three.
 */
export function PlatformStrategyPanel({
  clientId,
  strategy,
  audiences,
}: {
  clientId: string;
  strategy: SocialStrategy;
  audiences: AudienceOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [cadenceTarget, setCadenceTarget] = useState(strategy.cadence_target);
  const [cadencePeriod, setCadencePeriod] = useState(strategy.cadence_period);
  const [crossPost, setCrossPost] = useState(strategy.cross_post_rule);

  const report = (result: { ok: boolean; message?: string }) => {
    setError(result.ok ? null : (result.message ?? "That didn't save."));
  };

  const save =
    (
      field:
        | "platform_role"
        | "tone_voice"
        | "preferred_formats"
        | "content_length"
        | "hook_guidance"
        | "commercial_ratio"
        | "platform_exclusions"
        | "repurposing_rules"
        | "ai_instructions"
    ) =>
    (value: string) =>
      updateSocialStrategyField(clientId, strategy.id, field, value);

  const saveCadence = (target: number, period: string) => {
    setCadenceTarget(target);
    setCadencePeriod(period);
    setSocialCadence(clientId, strategy.id, target, period).then(report);
  };

  const saveAudience = (slot: "primary" | "secondary", value: string) => {
    setSocialAudienceLink(clientId, strategy.id, slot, value || null).then(report);
  };

  const ruleMeta = crossPostRuleMeta(crossPost);

  return (
    <div className="space-y-3 rounded-md border border-accent/30 bg-accent/5 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">Platform strategy</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          How this platform should be used. The content importer, AI generation and the cadence view all read these.
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`ps-role-${strategy.id}`}>Role in the strategy</Label>
          <Select
            id={`ps-role-${strategy.id}`}
            defaultValue={strategy.platform_role}
            onChange={(e) => save("platform_role")(e.target.value).then(report)}
          >
            {PLATFORM_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`ps-cadence-${strategy.id}`}>Target cadence</Label>
          <div className="flex gap-2">
            <input
              id={`ps-cadence-${strategy.id}`}
              type="number"
              min={0}
              max={99}
              value={cadenceTarget}
              onChange={(e) => setCadenceTarget(Number(e.target.value))}
              onBlur={(e) => saveCadence(Number(e.target.value), cadencePeriod)}
              className="w-20 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
            <Select
              aria-label="Cadence period"
              value={cadencePeriod}
              onChange={(e) => saveCadence(cadenceTarget, e.target.value)}
            >
              {CADENCE_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {cadenceTarget > 0 ? "Used for planned-vs-target on the Content tab." : "0 = not tracked."}
          </p>
        </div>

        <div>
          <Label htmlFor={`ps-aud1-${strategy.id}`}>Primary audience</Label>
          <Select
            id={`ps-aud1-${strategy.id}`}
            defaultValue={strategy.primary_audience_id ?? ""}
            onChange={(e) => saveAudience("primary", e.target.value)}
          >
            <option value="">Not set</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`ps-aud2-${strategy.id}`}>Secondary audience</Label>
          <Select
            id={`ps-aud2-${strategy.id}`}
            defaultValue={strategy.secondary_audience_id ?? ""}
            onChange={(e) => saveAudience("secondary", e.target.value)}
          >
            <option value="">Not set</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`ps-cross-${strategy.id}`}>Cross-posting rule</Label>
        <Select
          id={`ps-cross-${strategy.id}`}
          value={crossPost}
          onChange={(e) => {
            setCrossPost(e.target.value);
            updateSocialStrategyField(clientId, strategy.id, "cross_post_rule", e.target.value).then(report);
          }}
        >
          {CROSS_POST_RULES.map((rule) => (
            <option key={rule.value} value={rule.value}>
              {rule.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-ink-faint">{ruleMeta.hint}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AutosaveTextarea
          id={`ps-tone-${strategy.id}`}
          label="Tone & voice"
          helpText="e.g. senior, commercially literate, evidence-led."
          initialValue={strategy.tone_voice}
          onSave={save("tone_voice")}
          rows={2}
        />
        <AutosaveTextarea
          id={`ps-formats-${strategy.id}`}
          label="Preferred formats"
          helpText="e.g. written thought leadership, carousel, 30–75s talking head."
          initialValue={strategy.preferred_formats}
          onSave={save("preferred_formats")}
          rows={2}
        />
        <AutosaveInput
          id={`ps-length-${strategy.id}`}
          label="Typical length"
          initialValue={strategy.content_length}
          onSave={save("content_length")}
          placeholder="e.g. 150–250 words, or 30–60 seconds"
        />
        <AutosaveInput
          id={`ps-ratio-${strategy.id}`}
          label="Commercial balance"
          initialValue={strategy.commercial_ratio}
          onSave={save("commercial_ratio")}
          placeholder="e.g. 2/3 flagship offer, 1/3 wider authority"
        />
        <AutosaveTextarea
          id={`ps-hook-${strategy.id}`}
          label="How to open"
          helpText="How directly a post should start here."
          initialValue={strategy.hook_guidance}
          onSave={save("hook_guidance")}
          rows={2}
        />
        <AutosaveTextarea
          id={`ps-exclude-${strategy.id}`}
          label="Don't post here"
          helpText="Topics or content types this platform should not carry."
          initialValue={strategy.platform_exclusions}
          onSave={save("platform_exclusions")}
          rows={2}
        />
      </div>

      <AutosaveTextarea
        id={`ps-repurpose-${strategy.id}`}
        label="Repurposing rules"
        helpText="What can be shared with another platform, and what has to be rewritten."
        initialValue={strategy.repurposing_rules}
        onSave={save("repurposing_rules")}
        rows={2}
      />

      <AutosaveTextarea
        id={`ps-ai-${strategy.id}`}
        label="AI generation instructions"
        helpText="Applied whenever AI writes or adapts content for this account."
        initialValue={strategy.ai_instructions}
        onSave={save("ai_instructions")}
        rows={3}
      />
    </div>
  );
}
