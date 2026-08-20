"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import {
  updateContentOutputField,
  deleteContentOutput,
  scheduleContentOutput,
  unscheduleContentOutput,
  publishContentOutput,
} from "@/lib/actions/content";
import { outputStatusMeta, type OutputStatus } from "@/lib/status";
import { OutputMediaSlot } from "@/components/clients/OutputMediaSlot";
import { formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Output = Database["public"]["Tables"]["content_outputs"]["Row"];

export function ContentOutputRow({ clientId, output }: { clientId: string; output: Output }) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = outputStatusMeta(output.status as OutputStatus);
  const save = (
    field: "platform" | "format" | "caption" | "cta" | "hashtags" | "alt_text" | "destination_link" | "live_url" | "notes" | "reach" | "engagement" | "views"
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
          <span className="text-sm font-medium text-ink">{output.platform}</span>
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
          <AutosaveInput id={`out-platform-${output.id}`} label="Platform" initialValue={output.platform} onSave={save("platform")} />
          <AutosaveInput id={`out-format-${output.id}`} label="Format" initialValue={output.format} onSave={save("format")} placeholder="e.g. Carousel, Reel, Text post" />
        </div>
        <AutosaveTextarea id={`out-caption-${output.id}`} label="Final caption / copy" initialValue={output.caption} onSave={save("caption")} rows={3} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AutosaveInput id={`out-cta-${output.id}`} label="Call to action" initialValue={output.cta} onSave={save("cta")} />
          <AutosaveInput id={`out-hashtags-${output.id}`} label="Hashtags / tags" initialValue={output.hashtags} onSave={save("hashtags")} />
          <AutosaveInput id={`out-dest-${output.id}`} label="Destination link" initialValue={output.destination_link} onSave={save("destination_link")} placeholder="Where the CTA points" />
          <AutosaveInput id={`out-live-${output.id}`} label="Live post URL" initialValue={output.live_url} onSave={save("live_url")} />
          <AutosaveInput id={`out-alt-${output.id}`} label="Alt text" initialValue={output.alt_text} onSave={save("alt_text")} placeholder="Image description for accessibility" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OutputMediaSlot clientId={clientId} outputId={output.id} kind="media" url={output.media_url} />
          <OutputMediaSlot clientId={clientId} outputId={output.id} kind="thumbnail" url={output.thumbnail_url} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <AutosaveInput id={`out-reach-${output.id}`} label="Reach" type="number" initialValue={output.reach?.toString() ?? ""} onSave={save("reach")} />
          <AutosaveInput id={`out-eng-${output.id}`} label="Engagement" type="number" initialValue={output.engagement?.toString() ?? ""} onSave={save("engagement")} />
          <AutosaveInput id={`out-views-${output.id}`} label="Views" type="number" initialValue={output.views?.toString() ?? ""} onSave={save("views")} />
        </div>
        <AutosaveTextarea id={`out-notes-${output.id}`} label="Notes" initialValue={output.notes} onSave={save("notes")} rows={2} />

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
