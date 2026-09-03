"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { ExternalMediaField } from "@/components/clients/ExternalMediaField";
import { resolveMedia, mediaOriginLabel } from "@/lib/media-source";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import {
  updateContentOutputField,
  deleteContentOutput,
  scheduleContentOutput,
  unscheduleContentOutput,
  publishContentOutput,
  assignOutputAccount,
} from "@/lib/actions/content";
import { sendOutputToAyrshare, refreshAyrshareOutput } from "@/lib/actions/publishing";
import { outputStatusMeta, type OutputStatus } from "@/lib/status";
import { OutputMediaSlot } from "@/components/clients/OutputMediaSlot";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Output = Database["public"]["Tables"]["content_outputs"]["Row"];

export type PublishingAccount = { id: string; label: string };

export function ContentOutputRow({
  clientId,
  output,
  idea,
  accounts = [],
  ayrshareEnabled = false,
}: {
  clientId: string;
  output: Output;
  /** The parent content idea, for master-media inheritance. */
  idea?: { media_path: string | null; media_url: string | null; media_source_url: string; thumbnail_path: string | null; thumbnail_url: string | null; thumbnail_source_url: string };
  accounts?: PublishingAccount[];
  ayrshareEnabled?: boolean;
}) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleAyrsharePublish() {
    const scheduled = output.scheduled_at && new Date(output.scheduled_at).getTime() > Date.now() + 60_000;
    if (
      !scheduled &&
      !window.confirm("Publish this version to the connected social account right now?")
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendOutputToAyrshare(clientId, output.id);
      if (!result.ok) setError(result.message);
      else setNotice(result.data ?? "Done.");
    });
  }

  function handleAyrshareRefresh() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await refreshAyrshareOutput(clientId, output.id);
      if (!result.ok) setError(result.message);
      else setNotice(result.data ?? "Done.");
    });
  }

  const meta = outputStatusMeta(output.status as OutputStatus);
  // Master or override — Duane wants each version to say plainly which it is.
  const media = resolveMedia(output, idea);
  const save = (
    field: "platform" | "format" | "caption" | "cta" | "hashtags" | "alt_text" | "destination_link" | "media_source_url" | "thumbnail_source_url" | "live_url" | "notes" | "reach" | "engagement" | "views"
  ) => (value: string) => updateContentOutputField(clientId, output.id, field, value);

  function copyPost() {
    const parts = [output.caption, output.hashtags, output.cta && `CTA: ${output.cta}`, output.destination_link]
      .map((p) => (p ?? "").trim())
      .filter(Boolean);
    navigator.clipboard
      .writeText(parts.join("\n\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("Couldn't copy — your browser blocked clipboard access."));
  }

  function handleDelete() {
    if (!window.confirm(`Delete the ${output.platform} version? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteContentOutput(clientId, output.id);
      if (!result.ok) setError(result.message);
    });
  }

  function handleUnschedule() {
    startTransition(async () => {
      const result = await unscheduleContentOutput(clientId, output.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <details className="group/output rounded-md border border-border bg-surface-muted/40">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-ink-faint transition-transform duration-150 group-open/output:rotate-180">▾</span>
          <span className="truncate text-sm font-medium text-ink">
            {(output.social_account_id && accounts.find((a) => a.id === output.social_account_id)?.label) || output.platform}
          </span>
          {output.format && <span className="text-xs text-ink-faint">{output.format}</span>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {output.scheduled_at && output.status !== "published" && (
            <span className="text-xs text-ink-faint">{formatDateTime(output.scheduled_at)}</span>
          )}
          {output.published_at && output.status === "published" && (
            <span className="text-xs text-ink-faint">{formatDateTime(output.published_at)}</span>
          )}
          <StatusPill label={meta.label} color={meta.color} />
        </div>
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {output.status !== "published" && (
            <Button variant="primary" size="sm" onClick={() => setShowSchedule(true)}>
              {output.status === "scheduled" ? "Reschedule…" : "Schedule…"}
            </Button>
          )}
          {output.status === "scheduled" && (
            <Button variant="ghost" size="sm" onClick={handleUnschedule} disabled={isBusy}>
              Unschedule
            </Button>
          )}
          {output.status !== "published" && (
            <Button variant="secondary" size="sm" onClick={() => setShowPublish(true)}>
              Mark published…
            </Button>
          )}
          {output.status === "published" && output.live_url && (
            <a
              href={output.live_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent underline-offset-2 hover:underline"
            >
              View live post →
            </a>
          )}
          {ayrshareEnabled && output.status !== "published" && output.social_account_id && (
            <Button variant="secondary" size="sm" onClick={handleAyrsharePublish} disabled={isBusy}>
              {output.scheduled_at && new Date(output.scheduled_at).getTime() > Date.now() + 60_000
                ? "Send to Ayrshare (auto-publishes at the scheduled time)"
                : "Publish now via Ayrshare"}
            </Button>
          )}
          {ayrshareEnabled && output.ayrshare_post_id && output.status !== "published" && (
            <Button variant="ghost" size="sm" onClick={handleAyrshareRefresh} disabled={isBusy}>
              Check status
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={copyPost}>
            {copied ? "Copied ✓" : "Copy post"}
          </Button>
          <a
            href={`/api/publishing-pack/${output.id}`}
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            Download Publishing Pack ↓
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accounts.length > 0 ? (
            <div>
              <Label htmlFor={`out-account-${output.id}`}>Publishing account</Label>
              <Select
                id={`out-account-${output.id}`}
                value={output.social_account_id ?? ""}
                disabled={isBusy}
                onChange={(e) => {
                  const accountId = e.target.value || null;
                  startTransition(async () => {
                    const result = await assignOutputAccount(clientId, output.id, accountId);
                    if (!result.ok) setError(result.message);
                  });
                }}
              >
                <option value="">No account — platform only</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {!output.social_account_id && (
            <AutosaveInput id={`out-platform-${output.id}`} label="Platform" initialValue={output.platform} onSave={save("platform")} />
          )}
          <AutosaveInput id={`out-format-${output.id}`} label="Format" initialValue={output.format} onSave={save("format")} placeholder="e.g. Carousel, Reel, Text post" />
        </div>
        <AutosaveTextarea id={`out-caption-${output.id}`} label="Final caption / copy" initialValue={output.caption} onSave={save("caption")} rows={3} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id={`out-cta-${output.id}`} label="Call to action" initialValue={output.cta} onSave={save("cta")} />
          <AutosaveInput id={`out-hashtags-${output.id}`} label="Hashtags / tags" initialValue={output.hashtags} onSave={save("hashtags")} />
          <AutosaveInput id={`out-dest-${output.id}`} label="Destination link (CTA)" initialValue={output.destination_link} onSave={save("destination_link")} placeholder="Where the CTA points — not the video" />
          <AutosaveInput id={`out-live-${output.id}`} label="Live post URL" initialValue={output.live_url} onSave={save("live_url")} />
          <AutosaveInput id={`out-alt-${output.id}`} label="Alt text" initialValue={output.alt_text} onSave={save("alt_text")} placeholder="Image description for accessibility" />
        </div>
        {/* What this version will actually publish. */}
        <div className="rounded-md border border-border bg-surface-muted/40 px-3 py-2">
          <p className="text-xs">
            <span className="text-ink-soft">Media: </span>
            <span className={media.origin === "override" ? "font-medium text-accent" : media.origin === "master" ? "font-medium text-success" : "text-ink-faint"}>
              {mediaOriginLabel(media.origin)}
            </span>
          </p>
          {media.origin === "master" && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Inherited from the content idea. Upload below only if this platform needs something different.
            </p>
          )}
          {media.origin === "none" && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Upload master media on the content idea above and every platform inherits it.
            </p>
          )}
          {media.origin === "override" && idea && (idea.media_path || idea.media_source_url) && (
            <p className="mt-0.5 text-xs text-ink-faint">
              This platform uses its own file. Remove it below to go back to the master media.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OutputMediaSlot clientId={clientId} outputId={output.id} kind="media" url={output.media_url} />
          <OutputMediaSlot clientId={clientId} outputId={output.id} kind="thumbnail" url={output.thumbnail_url} />
        </div>
        {/* Media hosted elsewhere — for anything above the upload cap. This
            is what publishing sends to Ayrshare when it is set. */}
        <div className="space-y-3 rounded-md border border-border bg-surface-muted/40 p-3">
          <p className="text-xs font-medium text-ink-soft">Platform override — or media hosted elsewhere</p>
          <ExternalMediaField
            clientId={clientId}
            outputId={output.id}
            field="media_source_url"
            label="Media URL"
            initialValue={output.media_source_url}
            helpText="A direct link to the video or image. Used instead of the upload above when publishing."
          />
          <ExternalMediaField
            clientId={clientId}
            outputId={output.id}
            field="thumbnail_source_url"
            label="Thumbnail URL"
            initialValue={output.thumbnail_source_url}
            helpText="Optional. An uploaded thumbnail takes precedence over this."
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <AutosaveInput id={`out-reach-${output.id}`} label="Reach" type="number" initialValue={output.reach?.toString() ?? ""} onSave={save("reach")} />
          <AutosaveInput id={`out-eng-${output.id}`} label="Engagement" type="number" initialValue={output.engagement?.toString() ?? ""} onSave={save("engagement")} />
          <AutosaveInput id={`out-views-${output.id}`} label="Views" type="number" initialValue={output.views?.toString() ?? ""} onSave={save("views")} />
        </div>
        <AutosaveTextarea id={`out-notes-${output.id}`} label="Notes" initialValue={output.notes} onSave={save("notes")} rows={2} />

        {output.publish_error && !notice && (
          // The first line is the readable reason; everything under it is the
          // full Ayrshare response, tucked away but there when a publish
          // failure needs diagnosing rather than just reporting.
          <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2">
            <p className="text-xs font-medium text-danger">
              Last publish attempt failed
              {(() => {
                const line = output.publish_error.split("\n").find((l) => l.startsWith("Message: "));
                return line ? `: ${line.replace("Message: ", "")}` : `: ${output.publish_error.split("\n")[0]}`;
              })()}
            </p>
            {output.publish_error.includes("\n") && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-soft">
                  Full response from Ayrshare
                </summary>
                <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-muted/60 p-2 text-[11px] leading-relaxed text-ink-soft">
                  {output.publish_error}
                </pre>
              </details>
            )}
          </div>
        )}
        {notice && <p className="text-xs text-success">{notice}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isBusy}>
            Delete version
          </Button>
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal
          clientId={clientId}
          output={output}
          onClose={() => setShowSchedule(false)}
        />
      )}
      {showPublish && (
        <PublishModal clientId={clientId} output={output} onClose={() => setShowPublish(false)} />
      )}
    </details>
  );
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleModal({ clientId, output, onClose }: { clientId: string; output: Output; onClose: () => void }) {
  const [when, setWhen] = useState(toLocalInputValue(output.scheduled_at));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await scheduleContentOutput(clientId, output.id, when);
      if (!result.ok) setError(result.message);
      else onClose();
    });
  }

  return (
    <Modal title={`Schedule — ${output.platform}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <Notice kind="danger">{error}</Notice>}
        <div>
          <Label htmlFor={`sched-${output.id}`}>Publication date &amp; time</Label>
          <Input
            id={`sched-${output.id}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            autoFocus
          />
        </div>
        <p className="text-xs text-ink-faint">This puts the post on the Calendar. Only this platform version is scheduled.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={isPending || !when}>
            {isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PublishModal({ clientId, output, onClose }: { clientId: string; output: Output; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(publishContentOutput, null);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <Modal title={`Mark published — ${output.platform}`} onClose={onClose}>
      <form
        action={(formData) => {
          formData.set("client_id", clientId);
          formData.set("output_id", output.id);
          formAction(formData);
        }}
        className="space-y-3"
      >
        {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
        <div>
          <Label htmlFor={`pub-url-${output.id}`}>Live post URL</Label>
          <Input id={`pub-url-${output.id}`} name="live_url" defaultValue={output.live_url} autoComplete="off" autoFocus />
        </div>
        <div>
          <Label htmlFor={`pub-at-${output.id}`}>Actual publication date &amp; time</Label>
          <Input id={`pub-at-${output.id}`} name="published_at" type="datetime-local" defaultValue={toLocalInputValue(output.scheduled_at) || toLocalInputValue(new Date().toISOString())} />
        </div>
        <div>
          <Label htmlFor={`pub-notes-${output.id}`}>Publication notes</Label>
          <Textarea id={`pub-notes-${output.id}`} name="notes" rows={2} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Mark published"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
