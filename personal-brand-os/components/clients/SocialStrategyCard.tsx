"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { Button } from "@/components/ui/Button";
import { updateSocialStrategyField, deleteSocialStrategy } from "@/lib/actions/social";
import type { Database } from "@/lib/database.types";

type SocialStrategy = Database["public"]["Tables"]["social_strategies"]["Row"];

export function SocialStrategyCard({ clientId, strategy }: { clientId: string; strategy: SocialStrategy }) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (
    field: "platform" | "objective" | "audience" | "content_types" | "posting_frequency" | "growth_strategy" | "engagement_strategy" | "cta_strategy"
  ) => (value: string) => updateSocialStrategyField(clientId, strategy.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete the ${strategy.platform} strategy? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteSocialStrategy(clientId, strategy.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface" open={!strategy.objective && !strategy.growth_strategy}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-ink">{strategy.platform}</span>
        <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <AutosaveInput id={`soc-platform-${strategy.id}`} label="Platform" initialValue={strategy.platform} onSave={save("platform")} />
        <AutosaveTextarea
          id={`soc-objective-${strategy.id}`}
          label="Objective on this platform"
          helpText="What is this platform for — authority, reach, community, lead generation?"
          initialValue={strategy.objective}
          onSave={save("objective")}
          rows={2}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveTextarea
            id={`soc-audience-${strategy.id}`}
            label="Audience here"
            helpText="Who the client is speaking to on this platform specifically."
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
            helpText="The publishing cadence the client has committed to."
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
            {isDeleting ? "Deleting…" : "Delete platform"}
          </Button>
        </div>
      </div>
    </details>
  );
}
