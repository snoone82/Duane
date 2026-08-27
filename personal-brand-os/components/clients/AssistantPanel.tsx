"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { DictationButton } from "@/components/ui/DictationButton";
import { saveAssistantExchange, clearAssistantThread } from "@/lib/actions/assistant";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => setCopied(false));
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5v5.5a1.5 1.5 0 0 0 1.5 1.5h2"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
      {copied ? "Copied ✓" : label}
    </button>
  );
}

/**
 * The client assistant as a proper chat: the conversation fills the panel,
 * the composer sits at the bottom (Duane's ask), and every exchange is saved
 * per user per client so nothing is lost when you switch tabs.
 */
export function AssistantPanel({
  clientId,
  initialMessages,
}: {
  clientId: string;
  initialMessages: AssistantMessage[];
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, startClearing] = useTransition();
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest content in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, pending]);

  async function ask(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setError(null);
    setStreaming("");
    setPending(trimmed);
    setQuestion("");

    let answer = "";
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
        answer += decoder.decode(value, { stream: true });
        setStreaming(answer);
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      if (abortRef.current === controller) {
        if (answer.trim()) {
          // Commit the exchange to the thread, locally and on the server.
          const stamp = Date.now();
          setMessages((prev) => [
            ...prev,
            { id: `local-u-${stamp}`, role: "user", content: trimmed },
            { id: `local-a-${stamp}`, role: "assistant", content: answer },
          ]);
          void saveAssistantExchange(clientId, trimmed, answer);
        }
        setStreaming("");
        setPending(null);
        setIsRunning(false);
        abortRef.current = null;
      }
    }
  }

  function handleClear() {
    if (!window.confirm("Clear this conversation? Only your own thread for this client is removed.")) return;
    startClearing(async () => {
      const result = await clearAssistantThread(clientId);
      if (!result.ok) setError(result.message);
      else setMessages([]);
    });
  }

  const isEmpty = messages.length === 0 && !pending && !streaming;
  const transcript = messages.map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`).join("\n\n");

  return (
    <div className="flex h-[70dvh] min-h-96 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      {/* Thread */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-ink-soft">
              Ask anything about this client — the assistant reads their strategy, pillars, audiences, meetings, actions
              and pipeline, and only ever sees what you can see.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="secondary"
                  size="sm"
                  onClick={() => ask(preset.prompt)}
                  disabled={isRunning}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-soft px-3.5 py-2.5 text-sm text-ink">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="group/msg">
                  <div className="max-w-[92%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-surface-muted/50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
                    {message.content}
                  </div>
                  <div className="mt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100">
                    <CopyButton text={message.content} label="Copy answer" />
                  </div>
                </div>
              )
            )}
            {pending && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-soft px-3.5 py-2.5 text-sm text-ink">
                  {pending}
                </div>
              </div>
            )}
            {(streaming || isRunning) && (
              <div>
                <div className="max-w-[92%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-surface-muted/50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
                  {streaming}
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-text-bottom" aria-hidden />
                </div>
              </div>
            )}
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {/* Composer — pinned to the bottom */}
      <div className="border-t border-border bg-surface/80 p-3">
        {!isEmpty && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => ask(preset.prompt)}
                disabled={isRunning}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="space-y-2"
        >
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-label="Ask the assistant"
            placeholder="Ask anything… (Ctrl/Cmd + Enter to send)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask(question);
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <DictationButton
                disabled={isRunning}
                onText={(text) => setQuestion((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              />
              {messages.length > 0 && (
                <>
                  <CopyButton text={transcript} label="Copy conversation" />
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isClearing}
                    className="rounded-md px-2 py-1 text-xs text-ink-faint hover:text-danger"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                  Stop
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={isRunning || !question.trim()}>
                {isRunning ? "Thinking…" : "Ask"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
