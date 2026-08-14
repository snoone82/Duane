"use client";

import { useActionState, useEffect, useState } from "react";
import { addCommercialSnapshot } from "@/lib/actions/metrics";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Brief §15 Commercial Metrics.
const FIELDS: { name: string; label: string }[] = [
  { name: "leads_generated", label: "Leads generated" },
  { name: "enquiries", label: "Enquiries" },
  { name: "sales_calls", label: "Sales calls" },
  { name: "new_customers", label: "New customers" },
  { name: "opportunities_generated", label: "Opportunities generated" },
];

export function AddCommercialSnapshotButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addCommercialSnapshot, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        + Add period
      </Button>
      {isOpen && (
        <Modal title="Add commercial metrics" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="cs-date">Date</Label>
              <Input id="cs-date" name="period_date" type="date" defaultValue={today()} required autoFocus />
            </div>
            <p className="text-xs text-ink-faint">All fields optional — fill in whatever you have for this period.</p>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((field) => (
                <div key={field.name}>
                  <Label htmlFor={`cs-${field.name}`}>{field.label}</Label>
                  <Input id={`cs-${field.name}`} name={field.name} type="number" step="any" />
                </div>
              ))}
              <div>
                <Label htmlFor="cs-revenue">Revenue attributed (£)</Label>
                <Input id="cs-revenue" name="revenue_attributed" type="number" step="any" />
              </div>
            </div>
            <p className="text-xs text-ink-faint">Adding this again for the same date updates it, rather than duplicating.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
