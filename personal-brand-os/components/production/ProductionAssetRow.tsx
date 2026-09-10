"use client";

import { useState, useTransition } from "react";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateProductionAssetField, deleteProductionAsset } from "@/lib/actions/production";
import { PRODUCTION_ASSET_STATUS, productionAssetKindLabel } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { RunSheetAsset } from "@/lib/data/production";

/**
 * One asset on the run sheet.
 *
 * Collapsed it reads the way Duane sketched it — the hook, then what it
 * covers, then how it finishes — because that is what someone actually needs
 * while filming. Everything operational is behind the disclosure.
 *
 * "Feeds" is the many-to-many made visible: one talking head serving four
 * platforms should look like one job, not four.
 */
export function ProductionAssetRow({ clientId, asset }: { clientId: string; asset: RunSheetAsset }) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const meta = PRODUCTION_ASSET_STATUS.find((s) => s.value === asset.status) ?? PRODUCTION_ASSET_STATUS[0]!;

  const save = (field: "title" | "hook" | "brief" | "finish_cta" | "production_notes" | "owner_name" | "due_date") =>
    (value: string) => updateProductionAssetField(clientId, asset.id, field, value);

  return (
    <li className="rounded-md border border-border bg-surface-muted">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{asset.title}</span>
              <span className="block text-xs text-ink-faint">
                {productionAssetKindLabel(asset.kind)}
                {asset.ownerName && <span> · {asset.ownerName}</span>}
                {asset.dueDate && <span> · due {formatDate(asset.dueDate)}</span>}
              </span>
            </span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-2">
            <StatusPill label={meta.label} color={meta.color} />
          </span>
        </summary>

        <div className="space-y-3 border-t border-border px-3 py-3">
          {/* The shoot-facing three. Same fields the Tier 4 client sees. */}
          {asset.hook && (
            <p className="text-sm text-ink">
              <span className="text-xs uppercase tracking-wide text-ink-faint">Hook</span>
              <span className="mt-0.5 block">{asset.hook}</span>
            </p>
          )}
          {asset.brief && (
            <p className="text-sm text-ink-soft">
              <span className="text-xs uppercase tracking-wide text-ink-faint">Brief</span>
              <span className="mt-0.5 block whitespace-pre-wrap">{asset.brief}</span>
            </p>
          )}
          {asset.finishCta && (
            <p className="text-sm text-ink-soft">
              <span className="text-xs uppercase tracking-wide text-ink-faint">Finish</span>
              <span className="mt-0.5 block whitespace-pre-wrap">{asset.finishCta}</span>
            </p>
          )}

          {asset.feeds.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Feeds</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {asset.feeds.map((output) => (
                  <li key={output.id} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink-soft">
                    {output.accountName ? `${output.platform} — ${output.accountName}` : output.platform}
                    {output.format && <span className="text-ink-faint"> · {output.format}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-faint">
                One asset, {asset.feeds.length} platform version{asset.feeds.length === 1 ? "" : "s"} — made once.
              </p>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <StatusSelect
              value={asset.status}
              options={PRODUCTION_ASSET_STATUS}
              ariaLabel={`Status for ${asset.title}`}
              onChange={(value) => updateProductionAssetField(clientId, asset.id, "status", value)}
            />
          </div>

          <AutosaveInput id={`pa-title-${asset.id}`} label="Name" initialValue={asset.title} onSave={save("title")} />
          <AutosaveInput id={`pa-hook-${asset.id}`} label="Hook" initialValue={asset.hook} onSave={save("hook")} />
          <AutosaveTextarea id={`pa-brief-${asset.id}`} label="Brief" initialValue={asset.brief} onSave={save("brief")} rows={2} />
          <AutosaveTextarea
            id={`pa-finish-${asset.id}`}
            label="Finish / CTA"
            initialValue={asset.finishCta}
            onSave={save("finish_cta")}
            rows={2}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AutosaveInput id={`pa-owner-${asset.id}`} label="Owner" initialValue={asset.ownerName} onSave={save("owner_name")} />
            <AutosaveInput
              id={`pa-due-${asset.id}`}
              label="Due"
              type="date"
              initialValue={asset.dueDate ?? ""}
              onSave={save("due_date")}
            />
          </div>
          <AutosaveTextarea
            id={`pa-notes-${asset.id}`}
            label="Production notes"
            helpText="Internal — never shown to the client."
            initialValue={asset.productionNotes}
            onSave={save("production_notes")}
            rows={2}
          />

          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                if (!window.confirm(`Remove "${asset.title}" from production? The content itself is untouched.`)) return;
                startDelete(async () => {
                  const result = await deleteProductionAsset(clientId, asset.id);
                  if (!result.ok) setError(result.message);
                });
              }}
            >
              {isDeleting ? "Removing…" : "Remove asset"}
            </Button>
          </div>
        </div>
      </details>
    </li>
  );
}
