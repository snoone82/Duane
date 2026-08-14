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
          <AutosaveInput id="retainer_amount" label="Retainer ($/month)" type="number" initialValue={client.retainer_amount?.toString() ?? ""} onSave={save("retainer_amount")} />
          <AutosaveInput id="email" label="Email" type="email" initialValue={client.email ?? ""} onSave={save("email")} />
          <AutosaveInput id="phone" label="Phone" type="tel" initialValue={client.phone ?? ""} onSave={save("phone")} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Social profiles</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id="linkedin_url" label="LinkedIn URL" initialValue={client.linkedin_url ?? ""} onSave={save("linkedin_url")} />
          <AutosaveInput id="website_url" label="Website URL" initialValue={client.website_url ?? ""} onSave={save("website_url")} />
          <AutosaveInput id="twitter_url" label="X / Twitter URL" initialValue={client.twitter_url ?? ""} onSave={save("twitter_url")} />
          <AutosaveInput id="instagram_url" label="Instagram URL" initialValue={client.instagram_url ?? ""} onSave={save("instagram_url")} />
          <AutosaveInput id="youtube_url" label="YouTube URL" initialValue={client.youtube_url ?? ""} onSave={save("youtube_url")} />
          <AutosaveInput id="tiktok_url" label="TikTok URL" initialValue={client.tiktok_url ?? ""} onSave={save("tiktok_url")} />
        </div>
      </section>
    </>
  );
}
