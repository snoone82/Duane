"use client";

// Client Component on purpose: it hands StatusSelect an onChange closure
// over the updateClientField server action, and a closure created in a
// Server Component can't cross the RSC boundary ("Event handlers cannot be
// passed to Client Component props" — caught live on Vercel). Client
// Components may import and call server actions directly, so the closure
// is fine here.
import { useRef, useState, useTransition } from "react";
import { initials } from "@/lib/format";
import { CLIENT_STATUS } from "@/lib/status";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { updateClientField } from "@/lib/actions/clients";
import { uploadClientPhoto } from "@/lib/actions/files";
import type { Database } from "@/lib/database.types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

const LINKS: { key: keyof ClientRow; label: string }[] = [
  { key: "linkedin_url", label: "LinkedIn" },
  { key: "website_url", label: "Website" },
  { key: "twitter_url", label: "X / Twitter" },
  { key: "instagram_url", label: "Instagram" },
  { key: "youtube_url", label: "YouTube" },
  { key: "tiktok_url", label: "TikTok" },
];

export function ClientHeader({ client }: { client: ClientRow }) {
  const roleLine = [client.job_title, client.company].filter(Boolean).join(" at ");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [photoError, setPhotoError] = useState<string | null>(null);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startUpload(async () => {
      const result = await uploadClientPhoto(client.id, formData);
      if (!result.ok) setPhotoError(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Upload a profile photo"
          aria-label={`Upload a profile photo for ${client.name}`}
          className="group relative flex-shrink-0 rounded-full outline-offset-2"
        >
          {client.photo_url ? (
            // Plain <img>, not next/image — the photo URL is a Supabase Storage
            // URL whose host isn't known at build time, so next/image's remote
            // pattern allowlist can't be configured for it upfront.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.photo_url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-strong">
              {initials(client.name) || "?"}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {isUploading ? "Uploading…" : "Change"}
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        <div>
          <h1 className="text-xl font-semibold text-ink">{client.name}</h1>
          {roleLine && <p className="text-sm text-ink-soft">{roleLine}</p>}
          {photoError && <p className="text-xs text-danger">{photoError}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <StatusSelect
              value={client.status}
              options={CLIENT_STATUS}
              ariaLabel={`Status for ${client.name}`}
              onChange={(value) => updateClientField(client.id, "status", value)}
            />
            {LINKS.map(({ key, label }) => {
              const url = client[key] as string | null;
              if (!url) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
