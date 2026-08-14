import { initials } from "@/lib/format";
import { CLIENT_STATUS } from "@/lib/status";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { updateClientField } from "@/lib/actions/clients";
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

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-6">
      <div className="flex items-center gap-4">
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
            className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-strong">
            {initials(client.name) || "?"}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-ink">{client.name}</h1>
          {roleLine && <p className="text-sm text-ink-soft">{roleLine}</p>}
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
