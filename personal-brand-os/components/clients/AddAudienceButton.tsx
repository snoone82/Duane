"use client";

import { useActionState, useEffect, useState } from "react";
import { createAudience } from "@/lib/actions/audiences";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

export function AddAudienceButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createAudience, null);

  // Closes itself on a fresh success — the fast-entry requirement means
  // nobody should have to click Cancel after every successful add. Only
  // fires when `state` actually changes (a new dispatch resolved), not on
  // reopen, since useActionState keeps returning the same object reference
  // otherwise.
  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add audience
      </Button>
      {isOpen && (
        <Modal title="Add audience" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="audience-name">Name</Label>
              <Input id="audience-name" name="name" required autoFocus autoComplete="off" placeholder="e.g. Series A founders" />
            </div>
            <p className="text-xs text-ink-faint">Everything else can be filled in after — this just gets it started.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add audience"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
