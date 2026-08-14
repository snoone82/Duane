"use client";

import { useActionState, useEffect, useState } from "react";
import { setMetricTarget } from "@/lib/actions/metrics";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { PLATFORM_SUGGESTIONS } from "@/lib/metrics";

export function AddMetricTargetButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(setMetricTarget, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
        + Set target
      </Button>
      {isOpen && (
        <Modal title="Set platform target" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="target-platform">Platform</Label>
              <Input id="target-platform" name="platform" list="platform-suggestions-target" required autoFocus autoComplete="off" />
              <datalist id="platform-suggestions-target">
                {PLATFORM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="target-baseline">Baseline (optional)</Label>
                <Input id="target-baseline" name="baseline_value" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="target-value">Target</Label>
                <Input id="target-value" name="target_value" type="number" step="any" />
              </div>
            </div>
            <div>
              <Label htmlFor="target-date">Target date (optional)</Label>
              <Input id="target-date" name="target_date" type="date" />
            </div>
            <p className="text-xs text-ink-faint">Setting this again for the same platform replaces the previous target.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save target"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
