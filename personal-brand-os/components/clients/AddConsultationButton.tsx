"use client";

import { useActionState, useEffect, useState } from "react";
import { createConsultation } from "@/lib/actions/consultations";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddConsultationButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createConsultation, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add consultation
      </Button>
      {isOpen && (
        <Modal title="Add consultation" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="meeting_date">Meeting date</Label>
                <Input id="meeting_date" name="meeting_date" type="date" defaultValue={today()} required autoFocus />
              </div>
              <div>
                <Label htmlFor="meeting_type">Meeting type</Label>
                <Input id="meeting_type" name="meeting_type" autoComplete="off" placeholder="e.g. Strategy session" />
              </div>
            </div>
            <div>
              <Label htmlFor="next_meeting_date">Next meeting</Label>
              <Input id="next_meeting_date" name="next_meeting_date" type="date" />
            </div>
            <div>
              <Label htmlFor="attendees">Attendees</Label>
              <Input id="attendees" name="attendees" autoComplete="off" placeholder="e.g. Duane, client" />
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={5} placeholder="What was discussed…" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save consultation"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
