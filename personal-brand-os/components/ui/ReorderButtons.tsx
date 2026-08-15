"use client";

import { useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

/** Up/down arrows for priority-ordering cards. Lives inside a <summary>, so
 * clicks must not toggle the disclosure — hence preventDefault. */
export function ReorderButtons({
  isFirst,
  isLast,
  onMove,
  label,
}: {
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => Promise<ActionResult>;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  function move(event: React.MouseEvent, direction: "up" | "down") {
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      await onMove(direction);
    });
  }

  const buttonClass =
    "flex h-6 w-6 items-center justify-center rounded text-xs text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <span className="flex items-center">
      <button
        type="button"
        onClick={(e) => move(e, "up")}
        disabled={isFirst || isPending}
        aria-label={`Move ${label} up`}
        className={buttonClass}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={(e) => move(e, "down")}
        disabled={isLast || isPending}
        aria-label={`Move ${label} down`}
        className={buttonClass}
      >
        ↓
      </button>
    </span>
  );
}
