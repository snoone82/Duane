"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { attachOutputMedia, removeOutputMedia } from "@/lib/actions/content";
import { createClient } from "@/lib/supabase/client";
import { checkUploadSize } from "@/lib/uploads";

export function mediaKindFromUrl(url: string): "image" | "video" | "other" {
  const clean = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(png|jpe?g|webp|gif|avif)$/.test(clean)) return "image";
  if (/\.(mp4|mov|webm|m4v)$/.test(clean)) return "video";
  return "other";
}

export function MediaPreview({ url, compact = false }: { url: string; compact?: boolean }) {
  const kind = mediaKindFromUrl(url);
  const maxH = compact ? "max-h-40" : "max-h-64";
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, next/image can't optimise it
    return <img src={url} alt="Content media" className={`${maxH} rounded-md border border-border object-contain`} />;
  }
  if (kind === "video") {
    return <video src={url} controls className={`${maxH} w-full rounded-md border border-border`} preload="metadata" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-accent underline-offset-2 hover:underline">
      Open media file →
    </a>
  );
}

/** One media slot on a platform version — the asset itself or its thumbnail.
 * Upload → preview inline → replace/remove. The person posting downloads
 * from here; the client sees the same preview in the portal at approval. */
export function OutputMediaSlot({
  clientId,
  outputId,
  kind,
  url,
}: {
  clientId: string;
  outputId: string;
  kind: "media" | "thumbnail";
  url: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = kind === "media" ? "Media asset" : "Thumbnail";

  function handleFile(file: File | undefined) {
    if (!file) return;
    const sizeError = checkUploadSize(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    if (kind === "thumbnail" && !file.type.startsWith("image/")) {
      setError("Thumbnails must be images.");
      return;
    }
    setError(null);
    startTransition(async () => {
      // Upload straight from the browser to storage — server actions can't
      // carry files this large (1 MB action / 4.5 MB platform caps), which
      // is why the original upload path failed for real media.
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const storagePath = `clients/${clientId}/content/${outputId}/${kind}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const result = await attachOutputMedia(clientId, outputId, kind, storagePath);
      if (!result.ok) {
        await supabase.storage.from("client-files").remove([storagePath]);
        setError(result.message);
      }
    });
  }

  function handleRemove() {
    if (!window.confirm(`Remove the ${label.toLowerCase()}?`)) return;
    startTransition(async () => {
      const result = await removeOutputMedia(clientId, outputId, kind);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-soft">{label}</p>
      {url ? (
        <div className="space-y-1.5">
          <MediaPreview url={url} compact={kind === "thumbnail"} />
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent underline-offset-2 hover:underline">
              Download
            </a>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={isPending}>
              {isPending ? "Uploading…" : "Replace"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isPending}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={isPending}>
          {isPending ? "Uploading…" : `Upload ${kind === "media" ? "media" : "thumbnail"}…`}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={kind === "thumbnail" ? "image/*" : "image/*,video/*,.pdf"}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
