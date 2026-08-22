"use client";

// Client Component wrapper for the Overview tab's autosaving contact +
// social sections — the save() closures over updateClientField must be
// created client-side (see VisionForm for the full story).
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { updateClientField, type ClientHeaderInput } from "@/lib/actions/clients";
import type { Database } from "@/lib/database.types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export function ClientDetailsForms({ client }: { client: ClientRow }) {
  const save = (field: keyof ClientHeaderInput) => (value: string) => updateClientField(client.id, field, value);

  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Contact details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id="job_title" label="Job title" initialValue={client.job_title ?? ""} onSave={save("job_title")} />
          <AutosaveInput id="company" label="Company" initialValue={client.company ?? ""} onSave={save("company")} />
          <AutosaveInput id="industry" label="Industry" initialValue={client.industry ?? ""} onSave={save("industry")} />
          <AutosaveInput id="location" label="Location" initialValue={client.location ?? ""} onSave={save("location")} />
          <AutosaveInput id="package" label="Package" initialValue={client.package ?? ""} onSave={save("package")} />
          <AutosaveInput id="retainer_amount" label="Retainer (£/month)" type="number" initialValue={client.retainer_amount?.toString() ?? ""} onSave={save("retainer_amount")} />
          <AutosaveInput id="email" label="Email" type="email" initialValue={client.email ?? ""} onSave={save("email")} />
          <AutosaveInput id="phone" label="Phone" type="tel" initialValue={client.phone ?? ""} onSave={save("phone")} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Website</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id="website_url" label="Website URL" initialValue={client.website_url ?? ""} onSave={save("website_url")} />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Social account URLs live on the Social tab — the single source of truth. Mark accounts as Primary or Show on
          Overview there to control what appears here and in the header.
        </p>
      </section>
    </>
  );
}
