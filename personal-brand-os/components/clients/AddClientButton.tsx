"use client";

import { useActionState, useState } from "react";
import { createClientAction } from "@/lib/actions/clients";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { CLIENT_STATUS } from "@/lib/status";

export function AddClientButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createClientAction, null);

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setIsOpen(true)}>
        + Add client
      </Button>
      {isOpen && (
        <Modal title="Add client" onClose={() => setIsOpen(false)}>
          <form action={formAction} className="space-y-3">
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="job_title">Job title</Label>
              <Input id="job_title" name="job_title" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="prospect">
                {CLIENT_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add client"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
