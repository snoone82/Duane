"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { createClient } from "@/lib/supabase/client";
import { checkUploadSize } from "@/lib/uploads";
import {
  portalAttachIdeaMedia,
  portalDevelopIdeaField,
  portalSendIdeaToProduction,
} from "@/lib/actions/portal";

/**
 * Develop an idea into something producible — the client's own second stage.
 *
 * Duane, testing with Jonny: he could raise an idea and then not move it, so
 * the record stalled and the only way onward was for someone to recreate it
 * internally. This continues the SAME record; nothing is copied.
 *
 * Explicitly not the admin editor. Duane: "not to expose the whole
 * internal/admin screen just because it already exists." So there is no
 * owner, no approver, no dates, no platform versions, no status dropdown —
 * one forward button instead. The database enforces the same boundary
 * independently, so this is the shape of the thing rather than the guard on
 * it.
 */
export function DevelopIdeaPanel({
  clientId,
  idea,
  pillars,
  audiences,
}: {
  clientId: string;
  idea: {
    id: string;
    title: string;
    hook: string;
    body: string;
    notes: string;
    pillar_id: string | null;
    audience_id: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
  };
  pillars: { id: string; name: string }[];
  audiences: { id: string; name: string }[];
}) {
  const router = useRouter();
  const mediaRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"media" | "thumbnail" | "send" | null>(null);
  const [, startTransition] = useTransition();

  function upload(kind: "media" | "thumbnail", file: File | undefined) {
    if (!file) return;
    const sizeError = checkUploadSize(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    if (kind === "thumbnail" && !file.type.startsWith("image/")) {
      setError("A thumbnail needs to be an image.");
      return;
    }
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      // Browser straight to storage — the same route the team's uploads
      // take, and the only one a video can survive.
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const storagePath = `clients/${clientId}/content/${idea.id}/master-${kind}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadError) {
        setError(uploadError.message);
        setBusy(null);
        return;
      }
      const result = await portalAttachIdeaMedia(idea.id, kind, storagePath);
      if (!result.ok) {
        await supabase.storage.from("client-files").remove([storagePath]);
        setError(result.message);
      } else {
        router.refresh();
      }
      setBusy(null);
    });
  }

  function send() {
    if (
      !window.confirm(
        "Send this to the team to produce?\n\nYou won't be able to edit it here afterwards — they'll take it from this point and it comes back to you for approval."
      )
    ) {
      return;
    }
    setError(null);
    setBusy("send");
    startTransition(async () => {
      const result = await portalSendIdeaToProduction(idea.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
      setBusy(null);
    });
  }

  const save = (field: "title" | "hook" | "body" | "notes") => (value: string) =>
    portalDevelopIdeaField(idea.id, field, value);

  return (
    <div className="space-y-3">
      {error && <Notice kind="danger">{error}</Notice>}

      <AutosaveInput id={`dev-title-${idea.id}`} label="Title" initialValue={idea.title} onSave={save("title")} />

      <AutosaveTextarea
        id={`dev-hook-${idea.id}`}
        label="Hook"
        helpText="The opening line — what makes someone stop scrolling."
        initialValue={idea.hook}
        onSave={save("hook")}
        rows={2}
      />

      <AutosaveTextarea
        id={`dev-body-${idea.id}`}
        label="The content"
        helpText="What you want to say. A full draft or the bones of one — the team shapes it per platform."
        initialValue={idea.body}
        onSave={save("body")}
        rows={7}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`dev-pillar-${idea.id}`}>Pillar</Label>
          <Select
            id={`dev-pillar-${idea.id}`}
            defaultValue={idea.pillar_id ?? ""}
            onChange={(e) => void portalDevelopIdeaField(idea.id, "pillar_id", e.target.value)}
          >
            <option value="">Not sure / leave to the team</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`dev-audience-${idea.id}`}>Audience</Label>
          <Select
            id={`dev-audience-${idea.id}`}
            defaultValue={idea.audience_id ?? ""}
            onChange={(e) => void portalDevelopIdeaField(idea.id, "audience_id", e.target.value)}
          >
            <option value="">Not sure / leave to the team</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <AutosaveTextarea
        id={`dev-notes-${idea.id}`}
        label="Notes for the team"
        helpText="Anything they should know — context, who's in the video, what to avoid."
        initialValue={idea.notes}
        onSave={save("notes")}
        rows={3}
      />

      {/* One master asset and one cover, as on the team's side. Every
          platform version inherits them, so this is uploaded once. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["media", "thumbnail"] as const).map((kind) => {
          const url = kind === "media" ? idea.media_url : idea.thumbnail_url;
          const label = kind === "media" ? "Video or image" : "Cover image";
          return (
            <div key={kind} className="rounded-md border border-border bg-surface-muted/40 p-3">
              <p className="text-xs font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {kind === "media"
                  ? "The footage or image you want produced."
                  : "Optional — a still to represent it."}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {url && <MediaThumb url={url} kind={kind === "media" ? "video" : "image"} />}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => (kind === "media" ? mediaRef : thumbRef).current?.click()}
                  disabled={busy !== null}
                >
                  {busy === kind ? "Uploading…" : url ? "Replace…" : "Upload…"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <input
        ref={mediaRef}
        type="file"
        className="hidden"
        onChange={(e) => upload("media", e.target.files?.[0])}
      />
      <input
        ref={thumbRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload("thumbnail", e.target.files?.[0])}
      />

      <div className="border-t border-border pt-3">
        <Button variant="primary" onClick={send} disabled={busy !== null}>
          {busy === "send" ? "Sending…" : "Send to production"}
        </Button>
        <p className="mt-1.5 text-xs text-ink-faint">
          The team picks it up from here and shapes it for each platform. It comes back to you for approval before
          anything is published.
        </p>
      </div>
    </div>
  );
}
