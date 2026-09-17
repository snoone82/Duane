"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { previewContentImport, commitContentImport, type ContentImportPreview, type DuplicateAction } from "@/lib/actions/import";
import { attachIdeaMedia } from "@/lib/actions/content";
import { createClient } from "@/lib/supabase/client";
import { checkUploadSize } from "@/lib/uploads";
import { matchClipsToFiles, type ClipMatchReport } from "@/lib/import/clip-match";

type Stage =
  | { step: "edit" }
  | { step: "review"; preview: ContentImportPreview }
  | {
      step: "done";
      created: number;
      updated: number;
      skippedDuplicates: string[];
      outputsCreated: number;
      outputsUpdated: number;
      outputsSkipped: number;
      mediaAttached: number;
      mediaFailed: { fileName: string; message: string }[];
    };

/** What to do with a master whose title already exists. Duane's normal Tier 4
 * flow is a client submitting a raw idea and the team developing it later, so
 * enriching the existing record is the default rather than skipping it. */
const DUPLICATE_CHOICES: { value: DuplicateAction; label: string; hint: string }[] = [
  { value: "update", label: "Update the existing idea", hint: "Brings the new wording and adds the platform versions. A blank never overwrites what's there." },
  { value: "add_outputs", label: "Add platform versions only", hint: "Leaves the idea's own words alone." },
  { value: "create_new", label: "Create as a separate idea", hint: "Two ideas will share a title." },
  { value: "skip", label: "Skip it", hint: "Nothing changes." },
];

const DECISION_STYLE: Record<string, { dot: string; text: string }> = {
  include: { dot: "bg-success", text: "text-ink-soft" },
  review: { dot: "bg-amber-500", text: "text-ink" },
  exclude: { dot: "bg-ink-faint", text: "text-ink-faint line-through" },
};

export function ContentImportForm({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "edit" });
  const [error, setError] = useState<string | null>(null);
  // Selective-repurposing versions are proposed, never assumed — Duane keeps
  // the decision. Keys come straight from the preview so the same text
  // re-parsed at commit lines up exactly.
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  // Per-title choice for masters that already exist, keyed by lowercase title
  // to match what the server does with the same text.
  const [duplicateActions, setDuplicateActions] = useState<Record<string, DuplicateAction>>({});
  const [isPending, startTransition] = useTransition();

  // Batch master media (Duane, 17 Sep 2026): pick the finished MP4s alongside
  // the JSON and PBOS attaches each to the right record, instead of opening
  // six ideas one at a time to upload six videos.
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matches: ClipMatchReport | null = useMemo(() => {
    if (stage.step !== "review") return null;
    return matchClipsToFiles(
      stage.preview.ideas.map((idea) => ({ index: idea.index, title: idea.title, clipId: idea.clipId })),
      files.map((file) => file.name)
    );
  }, [stage, files]);

  const toggleKey = (key: string) =>
    setApprovedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function handlePreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewContentImport(clientId, text);
      if (!result.ok) setError(result.message);
      else {
        setApprovedKeys(new Set());
        setStage({ step: "review", preview: result.data });
      }
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const result = await commitContentImport(clientId, text, [...approvedKeys], duplicateActions);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Records exist now, so their ids exist — which is why media can only
      // be attached after the import, not alongside it. Same two steps as
      // the single-file master media slot: browser straight to storage (a
      // server action can't carry a video), then attach the path.
      const byIndex = new Map(result.data.records.map((record) => [record.index, record.id]));
      const filesByName = new Map(files.map((file) => [file.name, file]));
      const mediaFailed: { fileName: string; message: string }[] = [];
      let mediaAttached = 0;

      const toUpload = (matches?.rows ?? []).flatMap((row) =>
        row.match.state === "matched" && byIndex.has(row.index)
          ? [{ ideaId: byIndex.get(row.index)!, file: filesByName.get(row.match.fileName)! }]
          : []
      );

      const supabase = createClient();
      for (const [i, item] of toUpload.entries()) {
        if (!item.file) continue;
        setProgress(`Uploading video ${i + 1} of ${toUpload.length} — ${item.file.name}`);
        const sizeError = checkUploadSize(item.file);
        if (sizeError) {
          mediaFailed.push({ fileName: item.file.name, message: sizeError });
          continue;
        }
        const safeName = item.file.name.replace(/[^\w.\- ]+/g, "_");
        const storagePath = `clients/${clientId}/content/${item.ideaId}/master-media-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("client-files")
          .upload(storagePath, item.file, { contentType: item.file.type || undefined });
        if (uploadError) {
          mediaFailed.push({ fileName: item.file.name, message: uploadError.message });
          continue;
        }
        const attached = await attachIdeaMedia(clientId, item.ideaId, "media", storagePath);
        if (!attached.ok) {
          // Don't leave an orphan object behind that nothing points at.
          await supabase.storage.from("client-files").remove([storagePath]);
          mediaFailed.push({ fileName: item.file.name, message: attached.message });
          continue;
        }
        mediaAttached += 1;
      }

      setProgress(null);
      setStage({ step: "done", ...result.data, mediaAttached, mediaFailed });
    });
  }

  function handleFiles(list: FileList | null) {
    setFiles(list ? Array.from(list) : []);
  }

  if (stage.step === "done") {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <Notice kind="success">
          {stage.created} content idea{stage.created === 1 ? "" : "s"} created{stage.updated > 0 ? `, ${stage.updated} updated` : ""} with {stage.outputsCreated} new platform version
          {stage.outputsCreated === 1 ? "" : "s"}.
          {stage.outputsUpdated > 0 && ` ${stage.outputsUpdated} existing version${stage.outputsUpdated === 1 ? " was" : "s were"} updated rather than duplicated.`}
          {stage.outputsSkipped > 0 && ` ${stage.outputsSkipped} version${stage.outputsSkipped === 1 ? " was" : "s were"} not created, per the platform strategies.`}
        </Notice>
        {stage.mediaAttached > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            {stage.mediaAttached} master video{stage.mediaAttached === 1 ? "" : "s"} uploaded and attached. Every platform version
            inherits it automatically.
          </p>
        )}
        {stage.mediaFailed.length > 0 && (
          <div className="mt-2">
            <Notice kind="danger">
              {stage.mediaFailed.length} video{stage.mediaFailed.length === 1 ? "" : "s"} did not attach. The content records were
              still created — upload these from the idea itself.
            </Notice>
            <ul className="mt-1 list-inside list-disc text-xs text-ink-soft">
              {stage.mediaFailed.map((failure) => (
                <li key={failure.fileName}>
                  {failure.fileName}: {failure.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {stage.skippedDuplicates.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            Skipped as likely duplicates (same title already in the pipeline): {stage.skippedDuplicates.join(", ")}
          </p>
        )}
        <div className="mt-4">
          <Link href={`/clients/${clientId}/content`}>
            <Button variant="primary">Back to the Content pipeline →</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="content-import-text">Paste the AI&rsquo;s JSON output</Label>
        <Textarea
          id="content-import-text"
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (stage.step === "review") setStage({ step: "edit" });
          }}
          placeholder='{ "pbos_import": "content", "version": 1, "ideas": [ ... ] }'
          className="font-mono text-xs"
        />
      </div>

      {/* Pick the finished videos with the JSON. Matching happens here in the
          browser as soon as files are chosen, so the preview updates without
          a round trip. */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium text-ink">Master videos (optional)</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Select the finished MP4s for this batch. Each is matched to its record by the <code className="text-ink">clip_id</code>{" "}
          in the JSON appearing in the filename — <span className="text-ink">JG-S10-C03</span> matches{" "}
          <span className="text-ink">JG-S10-C03_final.mp4</span>. Anything that doesn&rsquo;t match exactly is left alone rather than guessed at.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
            {files.length > 0 ? "Change selection…" : "Select videos…"}
          </Button>
          {files.length > 0 && (
            <>
              <span className="text-xs text-ink-soft">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </span>
              <Button variant="ghost" size="sm" onClick={() => setFiles([])} disabled={isPending}>
                Clear
              </Button>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <Notice kind="danger">{error}</Notice>}

      {stage.step === "review" && (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold text-ink">Review before importing</h2>

          {/* The platform mix each account's strategy actually allows. */}
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-sm">
              <span className="font-semibold text-ink">{stage.preview.mixTotals.included}</span>{" "}
              <span className="text-ink-soft">platform version{stage.preview.mixTotals.included === 1 ? "" : "s"} will be created</span>
              {stage.preview.mixTotals.review > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-ink">{stage.preview.mixTotals.review}</span>{" "}
                  <span className="text-ink-soft">proposed for your decision</span>
                </>
              )}
              {stage.preview.mixTotals.excluded > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-ink">{stage.preview.mixTotals.excluded}</span>{" "}
                  <span className="text-ink-soft">excluded by platform strategy</span>
                </>
              )}
            </p>
            {stage.preview.mixTotals.review > 0 && (
              <p className="mt-1 text-xs text-ink-faint">
                Tick anything you want creating. Proposed versions are platforms set to selective repurposing, or accounts that
                aren&rsquo;t fully live — they&rsquo;re never added automatically.
              </p>
            )}
          </div>

          {/* Duane's validation preview: one line per record, matched or not,
              before anything is imported. */}
          {files.length > 0 && matches && (
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-sm font-medium text-ink">
                Video matching — {matches.matchedCount} of {files.length} file{files.length === 1 ? "" : "s"} matched
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {matches.rows.map((row) => (
                  <li key={row.index} className="text-xs">
                    {row.match.state === "matched" ? (
                      <span className="text-ink-soft">
                        <span className="text-success">✓</span>{" "}
                        <span className="text-ink">{row.clipId}</span> — {row.match.fileName}
                      </span>
                    ) : row.match.state === "no_clip_id" ? (
                      <span className="text-ink-faint">
                        — {row.title}: no clip_id in the JSON, so no video will be attached
                      </span>
                    ) : row.match.state === "ambiguous_files" ? (
                      <span className="text-amber-500">
                        ⚠ {row.clipId} — {row.match.fileNames.length} files match ({row.match.fileNames.join(", ")}). None
                        attached; rename so only one carries the clip id.
                      </span>
                    ) : (
                      <span className="text-amber-500">⚠ {row.clipId} — no matching video</span>
                    )}
                  </li>
                ))}
              </ul>
              {matches.ambiguousFiles.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-500">
                  ⚠ {matches.ambiguousFiles.map((f) => `${f.fileName} matches ${f.clipIds.join(" and ")}`).join("; ")} — not
                  attached to either.
                </p>
              )}
              {matches.unusedFiles.length > 0 && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Not used: {matches.unusedFiles.join(", ")}
                </p>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {stage.preview.ideas.map((idea) => (
              <li key={idea.index} className="rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-sm font-medium text-ink">
                  {idea.clipId && <span className="mr-1.5 font-mono text-xs text-ink-faint">{idea.clipId}</span>}
                  {idea.title}
                </p>
                {idea.duplicate && (
                  <div className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
                    <p className="text-xs font-medium text-ink">This idea is already in the pipeline. What should happen?</p>
                    <div className="mt-1.5 space-y-1">
                      {DUPLICATE_CHOICES.map((choice) => {
                        const key = idea.title.toLowerCase();
                        const current = duplicateActions[key] ?? "update";
                        return (
                          <label key={choice.value} className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`dupe-${key}`}
                              className="mt-0.5"
                              checked={current === choice.value}
                              onChange={() => setDuplicateActions((prev) => ({ ...prev, [key]: choice.value }))}
                            />
                            <span className="min-w-0">
                              <span className="block text-xs text-ink">{choice.label}</span>
                              <span className="block text-xs text-ink-faint">{choice.hint}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {idea.mix.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-faint">No platform versions — the master idea is created on its own.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {idea.mix.map((item) => {
                      const style = DECISION_STYLE[item.decision] ?? DECISION_STYLE.include!;
                      return (
                        <li key={item.key} className="flex items-start gap-2 text-xs">
                          {item.decision === "review" ? (
                            <input
                              type="checkbox"
                              checked={approvedKeys.has(item.key)}
                              onChange={() => toggleKey(item.key)}
                              className="mt-0.5 accent-[--color-accent]"
                              aria-label={`Create ${item.label}`}
                            />
                          ) : (
                            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} aria-hidden />
                          )}
                          <span className="min-w-0">
                            <span className={style.text}>{item.label}</span>
                            <span className="text-ink-faint"> — {item.reason}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {idea.flags.map((flag, i) => (
                  <p key={i} className="mt-1 text-xs text-amber-500">
                    ⚠ {flag}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          {stage.preview.needsConfirmation.length > 0 && (
            <p className="text-xs text-ink-soft">
              Marked as needing client confirmation (left blank): {stage.preview.needsConfirmation.join("; ")}
            </p>
          )}
          {stage.preview.warnings.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-soft">
              {stage.preview.warnings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setStage({ step: "edit" })}>
              Back to editing
            </Button>
            <Button variant="primary" onClick={handleCommit} disabled={isPending}>
              {isPending
                ? (progress ?? "Importing…")
                : matches && matches.matchedCount > 0
                  ? `Confirm & import (with ${matches.matchedCount} video${matches.matchedCount === 1 ? "" : "s"})`
                  : "Confirm & import"}
            </Button>
          </div>
        </div>
      )}

      {stage.step === "edit" && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={handlePreview} disabled={isPending || !text.trim()}>
            {isPending ? "Checking…" : "Preview import"}
          </Button>
        </div>
      )}
    </div>
  );
}
