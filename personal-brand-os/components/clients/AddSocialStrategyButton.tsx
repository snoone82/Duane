"use client";

import { useActionState, useEffect, useState } from "react";
import { createSocialStrategy } from "@/lib/actions/social";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

const SUGGESTED_PLATFORMS = ["LinkedIn", "Instagram", "YouTube", "TikTok", "X (Twitter)", "Facebook", "Threads", "Newsletter"];

export function AddSocialStrategyButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createSocialStrategy, null);

  // Closes itself on a fresh success — same fast-entry behaviour as every
  // other Add button (see AddAudienceButton for why this only fires on a
  // resolved dispatch).
  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add platform
      </Button>
      {isOpen && (
        <Modal title="Add platform strategy" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="social-platform">Platform</Label>
              <Input
                id="social-platform"
                name="platform"
                required
                autoFocus
                autoComplete="off"
                list="social-platform-suggestions"
                placeholder="e.g. LinkedIn"
              />
              <datalist id="social-platform-suggestions">
                {SUGGESTED_PLATFORMS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <p className="text-xs text-ink-faint">One strategy per platform — the objective, audience and cadence get filled in after.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add platform"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
