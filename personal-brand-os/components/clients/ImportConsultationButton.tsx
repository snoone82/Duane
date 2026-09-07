"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { createConsultationForAnalysis } from "@/lib/actions/consultation-analysis";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Plain-text transcript formats a meeting tool actually exports. Anything
 * else (a .docx, a PDF) has to be pasted — silently reading bytes as text
 * would produce a transcript full of rubbish and analyse it anyway. */
const TEXT_EXTENSIONS = /\.(txt|md|vtt|srt|csv|json|log|rtf)$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * The normal way consultation material gets into PBOS (Duane): paste or
 * upload the transcript, press Analyse, review what came back. The
 * structured-JSON route stays as the advanced one on the import page.
 */
export function ImportConsultationButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "analysing">("idle");
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  function close() {
    if (busy) return;
    setIsOpen(false);
    setError(null);
    setTranscript("");
    setFileNote("");
  }

  async function readFile(file: File) {
    setError(null);
    if (!TEXT_EXTENSIONS.test(file.name)) {
      setError(`"${file.name}" isn't a plain-text transcript. Export it as .txt or .vtt, or paste the text in below.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — too large for one consultation. Split it up.`);
      return;
    }
    const text = await file.text();
    // Appended, never replacing: someone who has already pasted part of a
    // meeting shouldn't lose it by adding the recording's transcript too.
    setTranscript((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text));
    setFileNote(`Loaded ${file.name} (${Math.round(text.length / 1000)}k characters).`);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(formData: FormData) {
    setError(null);
    formData.set("client_id", clientId);
    formData.set("transcript", transcript);

    if (!transcript.trim() && !String(formData.get("summary") ?? "").trim()) {
      setError("Add a transcript or some notes — there's nothing to analyse yet.");
      return;
    }

    setPhase("saving");
    const created = await createConsultationForAnalysis(formData);
    if (!created.ok) {
      setError(created.message);
      setPhase("idle");
      return;
    }

    // The consultation is saved at this point. Analysis failing from here on
    // loses nothing — the raw material is already the permanent record.
    setPhase("analysing");
    try {
      const response = await fetch("/api/consultation-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, consultationId: created.data }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(`${payload.error ?? "The analysis failed."} The consultation itself has been saved — you can analyse it again from its card.`);
        setPhase("idle");
        router.refresh();
        return;
      }
      close();
      setPhase("idle");
      router.refresh();
    } catch {
      setError("The analysis couldn't be reached. The consultation has been saved — analyse it again from its card.");
      setPhase("idle");
      router.refresh();
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        Import consultation
      </Button>
      {isOpen && (
        <Modal title="Import consultation" onClose={close}>
          <form action={submit} className="space-y-3">
            <p className="text-xs text-ink-soft">
              Paste or upload the transcript and PBOS will read it, pulling out the client&rsquo;s stories, beliefs, exact
              phrases, priorities and content opportunities. Nothing is saved to the Source Library or the profile until
              you have reviewed it. The raw transcript is kept permanently either way.
            </p>
            {error && <Notice kind="danger">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="i_meeting_date">Consultation date</Label>
                <Input id="i_meeting_date" name="meeting_date" type="date" defaultValue={today()} required disabled={busy} />
              </div>
              <div>
                <Label htmlFor="i_meeting_type">Type</Label>
                <Input id="i_meeting_type" name="meeting_type" autoComplete="off" placeholder="e.g. Strategy session" disabled={busy} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="i_title">Title (optional)</Label>
                <Input id="i_title" name="title" autoComplete="off" placeholder="e.g. Q4 positioning review" disabled={busy} />
              </div>
              <div>
                <Label htmlFor="i_attendees">Attendees</Label>
                <Input id="i_attendees" name="attendees" autoComplete="off" placeholder="e.g. Duane, client" disabled={busy} />
              </div>
            </div>
            <div>
              <Label htmlFor="i_file">Upload transcript</Label>
              <input
                ref={fileInput}
                id="i_file"
                type="file"
                accept=".txt,.md,.vtt,.srt,.csv,.json,.log,.rtf"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
                className="mt-1 block w-full text-xs text-ink-soft file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:text-ink hover:file:bg-surface-muted"
              />
              <p className="mt-1 text-xs text-ink-faint">
                Plain text only — .txt, .vtt, .srt and similar. Anything else, paste it below.
              </p>
              {fileNote && <p className="mt-1 text-xs text-success">{fileNote}</p>}
            </div>
            <div>
              <Label htmlFor="i_transcript">Transcript</Label>
              <Textarea
                id="i_transcript"
                rows={10}
                value={transcript}
                disabled={busy}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Paste the transcript here, or upload it above…"
              />
              {transcript.trim() && (
                <p className="mt-1 text-xs text-ink-faint">{Math.round(transcript.length / 1000)}k characters</p>
              )}
            </div>
            <div>
              <Label htmlFor="i_summary">Your own notes (optional)</Label>
              <Textarea
                id="i_summary"
                name="summary"
                rows={3}
                disabled={busy}
                placeholder="Anything the transcript won't capture — context, tone, what you noticed…"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {phase === "saving" ? "Saving…" : phase === "analysing" ? "Analysing — this can take a minute…" : "Analyse consultation"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
