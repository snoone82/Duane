"use client";

import { useActionState, useEffect, useState } from "react";
import { createLead } from "@/lib/actions/pbos-sales";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import type { TeamOwner, TierOption } from "@/components/sales/shared";

/** Adding a lead never touches the client roster. That is the whole point:
 * a prospect is not a client until the deal is won. */
export function AddLeadButton({ team, tiers }: { team: TeamOwner[]; tiers: TierOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createLead, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add lead
      </Button>
      {isOpen && (
        <Modal title="New PBOS lead" onClose={() => setIsOpen(false)}>
          <form action={formAction} className="space-y-3">
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="lead-name">Name</Label>
              <Input id="lead-name" name="name" required autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lead-company">Company</Label>
                <Input id="lead-company" name="company" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-job">Job title</Label>
                <Input id="lead-job" name="job_title" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-email">Email</Label>
                <Input id="lead-email" name="email" type="email" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-phone">Phone</Label>
                <Input id="lead-phone" name="phone" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-linkedin">LinkedIn</Label>
                <Input id="lead-linkedin" name="linkedin_url" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-website">Website</Label>
                <Input id="lead-website" name="website_url" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="lead-source">Source</Label>
                <Input id="lead-source" name="source" autoComplete="off" placeholder="Referral, LinkedIn, event…" />
              </div>
              <div>
                <Label htmlFor="lead-tier">Likely tier</Label>
                <Select id="lead-tier" name="tier_interest" defaultValue="">
                  <option value="">Not decided</option>
                  {tiers.map((tier) => (
                    <option key={tier.key} value={tier.key}>
                      {tier.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="lead-owner">Owner</Label>
              <Select id="lead-owner" name="owner" defaultValue="">
                <option value="">Me</option>
                {team.map((member) => (
                  <option key={member.id} value={`u:${member.id}`}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea id="lead-notes" name="notes" rows={2} />
            </div>
            <p className="text-xs text-ink-faint">
              This creates a lead, not a client. Add the deal next; winning it is what creates the client record.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add lead"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
