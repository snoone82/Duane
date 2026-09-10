"use client";

import { useActionState, useEffect, useState } from "react";
import { createProductionAsset } from "@/lib/actions/production";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { PRODUCTION_ASSET_KIND } from "@/lib/status";

/** One thing to make from this idea — a talking head, b-roll, a thumbnail.
 * Hook / Brief / Finish are the three lines a person reads on a shoot, and
 * the only ones a Tier 4 client sees. */
export function AddProductionAssetButton({
  clientId,
  jobId,
  contentId,
  contentTitle,
}: {
  clientId: string;
  jobId: string;
  contentId: string;
  contentTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProductionAsset, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        + Asset
      </Button>
      {isOpen && (
        <Modal title={`What are we making for "${contentTitle}"?`} onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formData.set("content_id", contentId);
              formData.set("job_id", jobId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pa_kind">Type</Label>
                <Select id="pa_kind" name="kind" defaultValue="talking_head">
                  {PRODUCTION_ASSET_KIND.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pa_due">Due</Label>
                <Input id="pa_due" name="due_date" type="date" />
              </div>
            </div>
            <div>
              <Label htmlFor="pa_title">Name</Label>
              <Input id="pa_title" name="title" required autoFocus placeholder="e.g. Main talking head" />
            </div>
            <div>
              <Label htmlFor="pa_hook">Hook</Label>
              <Input id="pa_hook" name="hook" placeholder="The opening line, as it will be said" />
            </div>
            <div>
              <Label htmlFor="pa_brief">Brief</Label>
              <Textarea id="pa_brief" name="brief" rows={2} placeholder="What this covers, in the order it runs" />
            </div>
            <div>
              <Label htmlFor="pa_finish">Finish / CTA</Label>
              <Textarea id="pa_finish" name="finish_cta" rows={2} placeholder="How it lands" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pa_owner">Owner</Label>
                <Input id="pa_owner" name="owner_name" placeholder="Who is making it" />
              </div>
            </div>
            <div>
              <Label htmlFor="pa_notes">Production notes (internal)</Label>
              <Textarea id="pa_notes" name="production_notes" rows={2} placeholder="Never shown to the client" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add asset"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
