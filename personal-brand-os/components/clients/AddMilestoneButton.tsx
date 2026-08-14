"use client";

import { useActionState, useEffect, useState } from "react";
import { createMilestone } from "@/lib/actions/milestones";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddMilestoneButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createMilestone, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add milestone
      </Button>
      {isOpen && (
        <Modal title="Add milestone" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="ms-title">Title</Label>
              <Input id="ms-title" name="title" required autoFocus autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="ms-date">Date</Label>
              <Input id="ms-date" name="milestone_date" type="date" defaultValue={today()} required />
            </div>
            <div>
              <Label htmlFor="ms-description">Description (optional)</Label>
              <Textarea id="ms-description" name="description" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="is_highlighted" className="h-4 w-4 rounded border-border-strong" />
              Highlight — shown to the client at renewal
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add milestone"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
