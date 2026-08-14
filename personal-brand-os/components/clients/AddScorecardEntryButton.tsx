"use client";

import { useActionState, useEffect, useState } from "react";
import { addScorecardEntry } from "@/lib/actions/metrics";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { SCORECARD_CATEGORIES } from "@/lib/scorecard";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddScorecardEntryButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addScorecardEntry, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        + Score a category
      </Button>
      {isOpen && (
        <Modal title="Add scorecard entry" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="score-category">Category</Label>
              <Select id="score-category" name="category" required autoFocus>
                {SCORECARD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="score-value">Score (0–10)</Label>
                <Input id="score-value" name="score" type="number" min={0} max={10} step="0.5" required />
              </div>
              <div>
                <Label htmlFor="score-date">Date</Label>
                <Input id="score-date" name="scored_at" type="date" defaultValue={today()} />
              </div>
            </div>
            <div>
              <Label htmlFor="score-notes">Notes (optional)</Label>
              <Textarea id="score-notes" name="notes" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save score"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
