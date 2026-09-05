"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMonthlyPlan } from "@/lib/actions/monthly-plans";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/** createMonthlyPlan isn't a (prevState, formData) action — it needs the
 * new plan's id back to redirect straight into it — so this is a plain
 * client-side submit rather than useActionState, matching the shape of
 * every other action here that returns data. */
export function AddMonthlyPlanButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!month) {
      setError("Pick a month.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createMonthlyPlan(clientId, month);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIsOpen(false);
      router.push(`/clients/${clientId}/plans/${result.data.id}`);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + New Monthly Plan
      </Button>
      {isOpen && (
        <Modal title="New Monthly Plan" onClose={() => setIsOpen(false)}>
          <div className="space-y-3">
            {error && <Notice kind="danger">{error}</Notice>}
            <div>
              <Label htmlFor="new-plan-month">Month</Label>
              <Input id="new-plan-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} autoFocus />
            </div>
            <p className="text-xs text-ink-faint">
              Pulls a snapshot of the client&rsquo;s current objectives, audiences, pillars and platform rules — editable
              from there, never re-pulled automatically.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submit} disabled={isPending}>
                {isPending ? "Creating…" : "Create plan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
