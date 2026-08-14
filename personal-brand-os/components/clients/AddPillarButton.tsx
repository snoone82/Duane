"use client";

import { useActionState, useEffect, useState } from "react";
import { createPillar } from "@/lib/actions/pillars";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

export function AddPillarButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createPillar, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        + Add pillar
      </Button>
      {isOpen && (
        <Modal title="Add content pillar" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="pillar-name">Name</Label>
              <Input id="pillar-name" name="name" required autoFocus autoComplete="off" placeholder="e.g. Founder lessons" />
            </div>
            <div>
              <Label htmlFor="pillar-description">Description</Label>
              <Textarea id="pillar-description" name="description" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add pillar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
