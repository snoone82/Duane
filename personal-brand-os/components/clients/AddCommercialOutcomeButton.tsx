"use client";

import { useActionState, useEffect, useState } from "react";
import { addCommercialOutcome } from "@/lib/actions/metrics";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddCommercialOutcomeButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addCommercialOutcome, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        + Log outcome
      </Button>
      {isOpen && (
        <Modal title="Log commercial outcome" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="outcome-description">Description</Label>
              <Textarea id="outcome-description" name="description" rows={2} required autoFocus placeholder="e.g. Inbound lead from LinkedIn post closed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="outcome-value">Value (£, optional)</Label>
                <Input id="outcome-value" name="value" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="outcome-date">Date</Label>
                <Input id="outcome-date" name="outcome_date" type="date" defaultValue={today()} />
              </div>
            </div>
            <div>
              <Label htmlFor="outcome-source">Source (optional)</Label>
              <Input id="outcome-source" name="source" autoComplete="off" placeholder="e.g. LinkedIn post, podcast appearance" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Log outcome"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
