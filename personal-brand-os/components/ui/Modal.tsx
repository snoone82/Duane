"use client";

import { useEffect, useRef } from "react";

/**
 * Deliberately does NOT close on backdrop click — the brief is explicit that
 * no modal should lose someone's input on a misclick. Escape and the
 * explicit close button are the only ways out. Autofocuses the first
 * focusable field so keyboard-only entry (the brief's core speed
 * requirement) never needs a mouse to get started.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    const firstField = dialogRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button"
    );
    firstField?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[10vh]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id="modal-title" className="text-sm font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-soft hover:bg-surface-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
