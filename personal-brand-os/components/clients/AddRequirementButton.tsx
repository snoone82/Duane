"use client";

import { useActionState, useEffect, useState } from "react";
import { addRequirement } from "@/lib/actions/monthly-plans";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { REQUIREMENT_TYPE } from "@/lib/status";

export function AddRequirementButton({ clientId, planId }: { clientId: string; planId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addRequirement, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        + Add requirement
      </Button>
      {isOpen && (
        <Modal title="Add requirement" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formData.set("monthly_plan_id", planId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="req-new-type">Type</Label>
              <Select id="req-new-type" name="type" defaultValue="other">
                {REQUIREMENT_TYPE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="req-new-desc">Description</Label>
              <Textarea id="req-new-desc" name="description" rows={2} required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="req-new-owner">Owner</Label>
                <Input id="req-new-owner" name="owner_note" autoComplete="off" placeholder="e.g. Client" />
              </div>
              <div>
                <Label htmlFor="req-new-due">Due date</Label>
                <Input id="req-new-due" name="due_date" type="date" />
              </div>
            </div>
            <div>
              <Label htmlFor="req-new-related">Related content</Label>
              <Input id="req-new-related" name="related_content_note" autoComplete="off" placeholder="e.g. MC-01, MC-02" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add requirement"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
