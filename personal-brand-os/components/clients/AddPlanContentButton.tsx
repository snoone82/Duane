"use client";

import { useActionState, useEffect, useState } from "react";
import { addPlanContentIdea } from "@/lib/actions/monthly-plans";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import type { Database } from "@/lib/database.types";

type Pillar = Database["public"]["Tables"]["brand_pillars"]["Row"];
type Audience = Database["public"]["Tables"]["audiences"]["Row"];
type PlatformAccount = { id: string; label: string };

export function AddPlanContentButton({
  clientId,
  planId,
  pillars,
  audiences,
  accounts = [],
}: {
  clientId: string;
  planId: string;
  pillars: Pillar[];
  audiences: Audience[];
  accounts?: PlatformAccount[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addPlanContentIdea, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setIsOpen(true)}>
        + Add Master Content
      </Button>
      {isOpen && (
        <Modal title="Add Master Content" onClose={() => setIsOpen(false)}>
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
              <Label htmlFor="pc-title">Title</Label>
              <Input id="pc-title" name="title" required autoFocus autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pc-pillar">Pillar</Label>
                <Select id="pc-pillar" name="pillar_id" defaultValue="">
                  <option value="">No pillar</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pc-audience">Audience</Label>
                <Select id="pc-audience" name="audience_id" defaultValue="">
                  <option value="">No audience</option>
                  {audiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pc-leadplatform">Lead platform</Label>
                <Select id="pc-leadplatform" name="lead_platform_id" defaultValue="">
                  <option value="">No lead platform</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <p className="text-xs text-ink-faint">Everything else — core message, hook, CTA, draft copy — can be filled in after.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
