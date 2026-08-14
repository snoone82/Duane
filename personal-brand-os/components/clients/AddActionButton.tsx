"use client";

import { useActionState, useEffect, useState } from "react";
import { createAction } from "@/lib/actions/actions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

export function AddActionButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAction, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add action
      </Button>
      {isOpen && (
        <Modal title="Add action" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="action-title">Title</Label>
              <Input id="action-title" name="title" required autoFocus autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="action-due">Due date</Label>
                <Input id="action-due" name="due_date" type="date" />
              </div>
              <div>
                <Label htmlFor="action-owner">Owner</Label>
                <Input id="action-owner" name="owner_name" autoComplete="off" placeholder="Defaults to you" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add action"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
