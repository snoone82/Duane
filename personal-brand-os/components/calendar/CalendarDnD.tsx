"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { scheduleContentOutput } from "@/lib/actions/content";

const DND_MIME = "application/x-pbos-output";

export interface TrayOutput {
  outputId: string;
  clientId: string;
  clientName: string;
  title: string;
  platform: string;
}

/** A ready-to-schedule post, draggable onto a calendar day. */
export function DraggableOutputChip({ output }: { output: TrayOutput }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, JSON.stringify(output));
        e.dataTransfer.effectAllowed = "move";
      }}
      title={`${output.title} — ${output.clientName}. Drag onto a day to schedule it at 09:00.`}
      className="inline-flex max-w-64 cursor-grab items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink shadow-sm active:cursor-grabbing"
    >
      <span aria-hidden>⠿</span>
      <span className="truncate">
        {output.title} · <span className="text-ink-soft">{output.platform}</span>
      </span>
    </span>
  );
}

/** Wraps one day cell; accepts a dragged output and schedules it at 09:00
 * that day (fine-tune the time afterwards from the Content tab). */
export function DroppableDay({ date, children }: { date: string; children: ReactNode }) {
  const [isOver, setIsOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div
      className={`h-full min-h-24 ${isOver ? "rounded-md ring-2 ring-accent" : ""} ${isPending ? "opacity-60" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        const raw = e.dataTransfer.getData(DND_MIME);
        if (!raw) return;
        e.preventDefault();
        let payload: TrayOutput;
        try {
          payload = JSON.parse(raw) as TrayOutput;
        } catch {
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await scheduleContentOutput(payload.clientId, payload.outputId, `${date}T09:00`);
          if (!result.ok) setError(result.message);
          else router.refresh();
        });
      }}
    >
      {children}
      {error && <p className="px-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
