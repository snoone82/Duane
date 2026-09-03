"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { attachIdeaMedia, removeIdeaMedia } from "@/lib/actions/content";
import { MediaPreview } from "@/components/clients/OutputMediaSlot";
import { createClient } from "@/lib/supabase/client";
import { checkUploadSize } from "@/lib/uploads";

/**
 * The master asset for a content idea (Duane, 3 Sep 2026).
 *
 * Upload the video or image once here and every platform version inherits it
 * automatically — he explicitly preferred that to a per-platform "copy link"
 * button. A version only stops inheriting when its own media is uploaded as
 * a deliberate override, and nothing is ever duplicated in storage: an
 * inheriting version resolves to this same object at publish time.
 */
export function MasterMediaSlot({
  clientId,
  ideaId,
  kind,
  url,
  inheritingCount,
}: {
  clientId: string;
  ideaId: string;
  kind: "media" | "thumbnail";
  url: string | null;
  /** How many platform versions are currently using this, for reassurance. */
  inheritingCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = kind === "media" ? "Master media" : "Master thumbnail";

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
      // Browser straight to storage, as with platform versions — a server
      // action can't carry a file this size.
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const storagePath = `clients/${clientId}/content/${ideaId}/master-${kind}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const result = await attachIdeaMedia(clientId, ideaId, kind, storagePath);
      if (!result.ok) {
        await supabase.storage.from("client-files").remove([storagePath]);
        setError(result.message);
      }
    });
  }

  function handleRemove() {
    const warning =
      inheritingCount && inheritingCount > 0
        ? `Remove the ${label.toLowerCase()}? ${inheritingCount} platform version${inheritingCount === 1 ? "" : "s"} currently inherit it and will be left with no media.`
        : `Remove the ${label.toLowerCase()}?`;
    if (!window.confirm(warning)) return;
    startTransition(async () => {
      const result = await removeIdeaMedia(clientId, ideaId, kind);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-ink-soft">{label}</p>
      <p className="mb-1.5 text-xs text-ink-faint">
        {kind === "media"
          ? "Uploaded once. Every platform version uses this unless you upload an override for that platform."
          : "Optional. Used by any platform version without its own thumbnail."}
      </p>
      {url ? (
        <div className="space-y-1.5">
          <MediaPreview url={url} compact={kind === "thumbnail"} />
          {kind === "media" && inheritingCount !== undefined && (
            <p className="text-xs text-success">
              {inheritingCount === 0
                ? "Every platform version has its own override, so this isn't being used."
                : `Used by ${inheritingCount} platform version${inheritingCount === 1 ? "" : "s"}.`}
            </p>
          )}
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
          {isPending ? "Uploading…" : `Upload ${kind === "media" ? "master media" : "master thumbnail"}…`}
        </Button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={kind === "thumbnail" ? "image/*" : undefined}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
