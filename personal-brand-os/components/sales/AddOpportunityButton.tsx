"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createOpportunity } from "@/lib/actions/sales-pipeline";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import type { TeamOwner } from "@/components/sales/OpportunityCard";

export interface ClientOption {
  id: string;
  name: string;
  status: string;
}

export function AddOpportunityButton({ clients, team }: { clients: ClientOption[]; team: TeamOwner[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createOpportunity, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  const prospects = clients.filter((c) => c.status === "prospect");
  const others = clients.filter((c) => c.status !== "prospect");

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add opportunity
      </Button>
      {isOpen && (
        <Modal title="New opportunity" onClose={() => setIsOpen(false)}>
          <form action={formAction} className="space-y-3">
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="opp-client">Prospect / client</Label>
              <Select id="opp-client" name="client_id" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {prospects.length > 0 && (
                  <optgroup label="Prospects">
                    {prospects.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Clients">
                    {others.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
              <p className="mt-1 text-xs text-ink-faint">
                New prospect? <Link href="/clients" className="text-accent hover:underline">Add them as a client with status Prospect</Link> first — when they&rsquo;re won, the same record becomes the active client.
              </p>
            </div>
            <div>
              <Label htmlFor="opp-title">Service / offer</Label>
              <Input id="opp-title" name="title" required autoComplete="off" placeholder="e.g. PBOS Guided, Personal brand retainer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="opp-contact">Contact</Label>
                <Input id="opp-contact" name="contact_name" autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="opp-source">Source</Label>
                <Input id="opp-source" name="source" autoComplete="off" placeholder="Referral, LinkedIn…" />
              </div>
              <div>
                <Label htmlFor="opp-value">Estimated value (£)</Label>
                <Input id="opp-value" name="estimated_value" type="number" min="0" step="1" />
              </div>
              <div>
                <Label htmlFor="opp-type">Value type</Label>
                <Select id="opp-type" name="value_type" defaultValue="monthly">
                  <option value="monthly">Monthly</option>
                  <option value="project">One-off project</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="opp-prob">Probability %</Label>
                <Input id="opp-prob" name="probability" type="number" min="0" max="100" defaultValue="50" />
              </div>
              <div>
                <Label htmlFor="opp-close">Expected close</Label>
                <Input id="opp-close" name="expected_close" type="date" />
              </div>
            </div>
            <div>
              <Label htmlFor="opp-owner">Owner</Label>
              <Select id="opp-owner" name="owner" defaultValue="">
                <option value="">Me</option>
                {team.map((member) => (
                  <option key={member.id} value={`u:${member.id}`}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="opp-notes">Notes</Label>
              <Textarea id="opp-notes" name="notes" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Creating…" : "Create opportunity"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
