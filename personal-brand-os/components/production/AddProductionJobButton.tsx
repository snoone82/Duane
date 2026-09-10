"use client";

import { useActionState, useEffect, useState } from "react";
import { createProductionJob } from "@/lib/actions/production";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

/** A production day — the filming/design session Duane agrees with a client
 * once the month's content is settled. */
export function AddProductionJobButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProductionJob, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Production day
      </Button>
      {isOpen && (
        <Modal title="New production day" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="pj_title">What is this day?</Label>
              <Input id="pj_title" name="title" required autoFocus placeholder="e.g. Jonny Gallanders — filming day" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pj_date">Date</Label>
                <Input id="pj_date" name="production_date" type="date" required />
              </div>
              <div>
                <Label htmlFor="pj_time">Start time (optional)</Label>
                <Input id="pj_time" name="start_time" type="time" />
              </div>
            </div>
            <div>
              <Label htmlFor="pj_location">Location</Label>
              <Input id="pj_location" name="location" placeholder="e.g. CEG offices, Manchester" />
            </div>
            <div>
              <Label htmlFor="pj_notes">Notes</Label>
              <Textarea id="pj_notes" name="notes" rows={2} placeholder="Kit, crew, anything the day depends on…" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Creating…" : "Create day"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
