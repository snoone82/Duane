"use client";

import { useTransition } from "react";
import { endPreview } from "@/lib/actions/preview";

/**
 * Unmissable, and always on screen. Duane's requirement is that a preview
 * can never be mistaken for the real thing — so this sits above everything,
 * says whose view it is, says plainly that it's read-only, and offers the
 * way out in the same breath.
 */
export function PreviewBanner({ name }: { name: string }) {
  const [isExiting, startExit] = useTransition();

  return (
    <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500/15 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <p className="text-sm text-ink">
          <span className="font-semibold">Viewing as {name} — preview mode, read only</span>
          <span className="text-ink-soft"> · This is their view, with their permissions. Nothing here can change anything or reach the client.</span>
        </p>
        <button
          type="button"
          onClick={() =>
            startExit(async () => {
              await endPreview();
              // Full reload: every server component on the page was rendered
              // with the other user's permissions and must be rebuilt.
              window.location.href = "/";
            })
          }
          className="flex-shrink-0 rounded-md border border-amber-500/50 bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-60"
          disabled={isExiting}
        >
          {isExiting ? "Exiting…" : "Exit user view"}
        </button>
      </div>
    </div>
  );
}
