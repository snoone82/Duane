"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea, Label } from "@/components/ui/Input";

const PRESETS = [
  {
    label: "Suggest content ideas",
    prompt:
      "Suggest 8 specific content ideas for this client. Spread them across the content pillars and platforms, name which pillar and audience each one serves, and avoid repeating anything already in the pipeline.",
  },
  {
    label: "Prep me for the next meeting",
    prompt:
      "Prepare me for the next meeting with this client. Summarise where things stand, what was agreed last time and whether it happened, which actions are open or overdue, and the three most useful things to raise.",
  },
  {
    label: "Find strategy gaps",
    prompt:
      "Review this client's profile end to end and identify the gaps: sections that are empty or thin, inconsistencies between vision, positioning, audiences, platform strategy and sales strategy, and the two or three highest-impact things to fix first.",
  },
];

export function AssistantPanel({ clientId }: { clientId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setError(null);
    setAnswer("");
    setAsked(trimmed);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, prompt: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `The assistant returned an error (${response.status}).`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("The assistant returned an empty response.");
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      if (abortRef.current === controller) {
        setIsRunning(false);
        abortRef.current = null;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button key={preset.label} variant="secondary" size="sm" onClick={() => ask(preset.prompt)} disabled={isRunning}>
            {preset.label}
          </Button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="space-y-2"
      >
        <div>
          <Label htmlFor="assistant-question">Or ask anything about this client</Label>
          <Textarea
            id="assistant-question"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Draft a LinkedIn post from the last meeting's win, in the client's voice."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask(question);
              }
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          {isRunning && (
            <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              Stop
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isRunning || !question.trim()}>
            {isRunning ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {(answer || isRunning) && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{asked}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {answer}
            {isRunning && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-text-bottom" aria-hidden />}
          </div>
        </div>
      )}
    </div>
  );
}
