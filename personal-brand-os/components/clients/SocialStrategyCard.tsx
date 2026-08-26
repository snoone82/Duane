"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { updateSocialStrategyField, toggleSocialAccountFlag, deleteSocialStrategy } from "@/lib/actions/social";
import { setSocialPublishing } from "@/lib/actions/publishing";
import { socialAccountLabel } from "@/lib/format";
import type { ConnectionProfile } from "@/components/clients/AyrshareConnections";
import type { Database } from "@/lib/database.types";

type SocialStrategy = Database["public"]["Tables"]["social_strategies"]["Row"];

const AYRSHARE_PLATFORM_OPTIONS = [
  { value: "", label: "Not publishing via Ayrshare" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook Page" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
  { value: "gmb", label: "Google Business" },
];

const ACCOUNT_TYPES = [
  { value: "", label: "Type not set" },
  { value: "personal", label: "Personal" },
  { value: "company", label: "Company" },
  { value: "programme", label: "Programme" },
];

const ACCOUNT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "planned", label: "Planned" },
  { value: "inactive", label: "Inactive" },
];

function FlagToggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-ink-soft" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[--color-accent]" />
      {label}
    </label>
  );
}

export function SocialStrategyCard({
  clientId,
  strategy,
  ayrshareEnabled = false,
  connectionProfiles = [],
}: {
  clientId: string;
  strategy: SocialStrategy;
  ayrshareEnabled?: boolean;
  connectionProfiles?: ConnectionProfile[];
}) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ayrPlatform, setAyrPlatform] = useState(strategy.ayrshare_platform);
  const [ayrProfileId, setAyrProfileId] = useState(strategy.ayrshare_profile_id ?? "");

  const savePublishing = (platform: string, profileId: string) => {
    setAyrPlatform(platform);
    setAyrProfileId(profileId);
    setSocialPublishing(clientId, strategy.id, platform, profileId || null).then((result) => {
      if (!result.ok) setError(result.message);
    });
  };

  const save = (
    field: "platform" | "account_name" | "owner_brand" | "url" | "account_type" | "account_status" | "objective" | "audience" | "content_types" | "posting_frequency" | "growth_strategy" | "engagement_strategy" | "cta_strategy"
  ) => (value: string) => updateSocialStrategyField(clientId, strategy.id, field, value);

  const toggle = (flag: "is_primary" | "show_on_overview" | "publishing_enabled") => (value: boolean) =>
    toggleSocialAccountFlag(clientId, strategy.id, flag, value).then((result) => {
      if (!result.ok) setError(result.message);
    });

  function handleDelete() {
    if (!window.confirm(`Delete ${socialAccountLabel(strategy.platform, strategy.account_name)}? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteSocialStrategy(clientId, strategy.id);
      if (!result.ok) setError(result.message);
    });
  }

  const statusMeta = ACCOUNT_STATUSES.find((s) => s.value === strategy.account_status);

  return (
    <details className="group rounded-lg border border-border bg-surface" open={!strategy.objective && !strategy.growth_strategy}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">
            {socialAccountLabel(strategy.platform, strategy.account_name)}
          </span>
          {strategy.is_primary && <StatusPill label="Primary" color="teal" />}
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          {strategy.account_status !== "active" && (
            <StatusPill label={statusMeta?.label ?? strategy.account_status} color={strategy.account_status === "planned" ? "amber" : "slate"} />
          )}
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        {/* The account itself — the single source of truth for this URL. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id={`soc-platform-${strategy.id}`} label="Platform" initialValue={strategy.platform} onSave={save("platform")} />
          <AutosaveInput id={`soc-account-${strategy.id}`} label="Account / channel name" initialValue={strategy.account_name} onSave={save("account_name")} placeholder="e.g. Daniel Andrews, CEG Programme" />
          <AutosaveInput id={`soc-brand-${strategy.id}`} label="Owner / brand" initialValue={strategy.owner_brand} onSave={save("owner_brand")} placeholder="e.g. Daniel / CEG / CEG Girls" />
          <AutosaveInput id={`soc-url-${strategy.id}`} label="URL" initialValue={strategy.url} onSave={save("url")} placeholder="https://…" />
          <div>
            <Label htmlFor={`soc-type-${strategy.id}`}>Account type</Label>
            <Select id={`soc-type-${strategy.id}`} defaultValue={strategy.account_type} onChange={(e) => save("account_type")(e.target.value)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`soc-status-${strategy.id}`}>Status</Label>
            <Select id={`soc-status-${strategy.id}`} defaultValue={strategy.account_status} onChange={(e) => save("account_status")(e.target.value)}>
              {ACCOUNT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 rounded-md bg-surface-muted/40 px-3 py-2">
          <FlagToggle label="Primary account" checked={strategy.is_primary} onChange={toggle("is_primary")} hint="Shown in the client header strip" />
          <FlagToggle label="Show on Overview" checked={strategy.show_on_overview} onChange={toggle("show_on_overview")} hint="Listed in the Overview's Social profiles panel" />
          <FlagToggle label="Publishing enabled" checked={strategy.publishing_enabled} onChange={toggle("publishing_enabled")} hint="Offered as a publishing account when approving content" />
        </div>

        {ayrshareEnabled && (
          <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-2">
            <p className="mb-2 text-xs font-medium text-ink-soft">Direct publishing (Ayrshare)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`soc-ayr-platform-${strategy.id}`}>Network</Label>
                <Select
                  id={`soc-ayr-platform-${strategy.id}`}
                  value={ayrPlatform}
                  onChange={(e) => savePublishing(e.target.value, ayrProfileId)}
                >
                  {AYRSHARE_PLATFORM_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`soc-ayr-profile-${strategy.id}`}>Connection</Label>
                <Select
                  id={`soc-ayr-profile-${strategy.id}`}
                  value={ayrProfileId}
                  onChange={(e) => savePublishing(ayrPlatform, e.target.value)}
                >
                  <option value="">Primary connection (default)</option>
                  {connectionProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}

        <AutosaveTextarea
          id={`soc-objective-${strategy.id}`}
          label="Objective on this platform"
          helpText="What is this account for — authority, reach, community, lead generation?"
          initialValue={strategy.objective}
          onSave={save("objective")}
          rows={2}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveTextarea
            id={`soc-audience-${strategy.id}`}
            label="Audience here"
            helpText="Who this account is speaking to specifically."
            initialValue={strategy.audience}
            onSave={save("audience")}
            rows={2}
          />
          <AutosaveTextarea
            id={`soc-content-${strategy.id}`}
            label="Content types"
            helpText="Formats that work here — carousels, long-form posts, shorts, lives…"
            initialValue={strategy.content_types}
            onSave={save("content_types")}
            rows={2}
          />
          <AutosaveTextarea
            id={`soc-freq-${strategy.id}`}
            label="Posting frequency"
            helpText="The publishing cadence committed to for this account."
            initialValue={strategy.posting_frequency}
            onSave={save("posting_frequency")}
            rows={2}
          />
          <AutosaveTextarea
            id={`soc-cta-${strategy.id}`}
            label="Call-to-action strategy"
            helpText="What each post should move people towards — follows, DMs, the lead magnet."
            initialValue={strategy.cta_strategy}
            onSave={save("cta_strategy")}
            rows={2}
          />
        </div>
        <AutosaveTextarea
          id={`soc-growth-${strategy.id}`}
          label="Growth strategy"
          helpText="How the audience grows here — collaborations, hashtags, repurposing, ads."
          initialValue={strategy.growth_strategy}
          onSave={save("growth_strategy")}
          rows={2}
        />
        <AutosaveTextarea
          id={`soc-engage-${strategy.id}`}
          label="Engagement strategy"
          helpText="Commenting, replying and community habits that build relationships."
          initialValue={strategy.engagement_strategy}
          onSave={save("engagement_strategy")}
          rows={2}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>
    </details>
  );
}
