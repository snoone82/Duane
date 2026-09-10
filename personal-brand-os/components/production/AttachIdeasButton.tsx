"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { addIdeasToJob } from "@/lib/actions/production";

/** Attach approved Master Content to a production day. Only approved-and-
 * onwards content is offered: a day is for producing decisions that have
 * already been made, not for choosing what to make. */
export function AttachIdeasButton({
  clientId,
  jobId,
  available,
}: {
  clientId: string;
  jobId: string;
  available: { id: string; title: string; status: string }[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addIdeasToJob(clientId, jobId, [...picked]);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIsOpen(false);
      setPicked(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} disabled={available.length === 0}>
        {available.length === 0 ? "Nothing left to attach" : "Attach content"}
      </Button>
      {isOpen && (
        <Modal title="Attach content to this day" onClose={() => setIsOpen(false)}>
          <div className="space-y-3">
            {error && <Notice kind="danger">{error}</Notice>}
            <p className="text-xs text-ink-soft">
              Approved Master Content not already on this day. Attaching points the run sheet at the existing record —
              nothing is copied — and creates the obvious assets from each idea&rsquo;s platform versions, so you only add
              the extras.
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {available.map((idea) => (
                <li key={idea.id}>
                  <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                    <input type="checkbox" className="mt-0.5" checked={picked.has(idea.id)} onChange={() => toggle(idea.id)} />
                    <span className="min-w-0 text-sm text-ink">{idea.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={isPending || picked.size === 0}>
                {isPending ? "Attaching…" : `Attach ${picked.size || ""}`.trim()}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
