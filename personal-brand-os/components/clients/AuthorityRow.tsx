"use client";

import { useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Button } from "@/components/ui/Button";
import { updateAuthorityField, updateAuthorityStatus, deleteAuthorityOpportunity } from "@/lib/actions/authority";
import { AUTHORITY_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Opportunity = Database["public"]["Tables"]["authority_opportunities"]["Row"];

export function AuthorityRow({ clientId, opportunity }: { clientId: string; opportunity: Opportunity }) {
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: "type" | "host" | "contact_name" | "contact_email" | "opportunity_date" | "published_url" | "notes" | "audience_size") =>
    (value: string) => updateAuthorityField(clientId, opportunity.id, field, value);

  function handleDelete() {
    if (!window.confirm(`Delete this ${opportunity.type} opportunity? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteAuthorityOpportunity(clientId, opportunity.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open:rotate-180">▾</span>
          <span className="truncate text-sm text-ink">{opportunity.type}</span>
          {opportunity.host && <span className="truncate text-xs text-ink-soft">{opportunity.host}</span>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {opportunity.status === "published" && opportunity.published_url && (
            <a
              href={opportunity.published_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-accent hover:underline"
            >
              View
            </a>
          )}
          {opportunity.opportunity_date && <span className="text-xs text-ink-faint">{formatDate(opportunity.opportunity_date)}</span>}
          <StatusSelect
            value={opportunity.status}
            options={AUTHORITY_STATUS}
            ariaLabel={`Status for ${opportunity.type} opportunity`}
            onChange={(value) => updateAuthorityStatus(clientId, opportunity.id, value)}
          />
        </div>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id={`auth-type-${opportunity.id}`} label="Type" initialValue={opportunity.type} onSave={save("type")} />
          <AutosaveInput id={`auth-host-${opportunity.id}`} label="Host / publication" initialValue={opportunity.host ?? ""} onSave={save("host")} />
          <AutosaveInput id={`auth-contact-name-${opportunity.id}`} label="Contact name" initialValue={opportunity.contact_name ?? ""} onSave={save("contact_name")} />
          <AutosaveInput id={`auth-contact-email-${opportunity.id}`} label="Contact email" type="email" initialValue={opportunity.contact_email ?? ""} onSave={save("contact_email")} />
          <AutosaveInput id={`auth-date-${opportunity.id}`} label="Date" type="date" initialValue={opportunity.opportunity_date ?? ""} onSave={save("opportunity_date")} />
          <AutosaveInput id={`auth-url-${opportunity.id}`} label="Published URL" initialValue={opportunity.published_url ?? ""} onSave={save("published_url")} />
          <AutosaveInput id={`auth-audience-${opportunity.id}`} label="Audience size" type="number" initialValue={opportunity.audience_size?.toString() ?? ""} onSave={save("audience_size")} />
        </div>
        <AutosaveTextarea id={`auth-notes-${opportunity.id}`} label="Notes" initialValue={opportunity.notes} onSave={save("notes")} rows={2} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete opportunity"}
          </Button>
        </div>
      </div>
    </details>
  );
}
