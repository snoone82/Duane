"use client";

import { useActionState, useEffect, useState } from "react";
import { createContentIdea } from "@/lib/actions/content";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import type { Database } from "@/lib/database.types";

type Pillar = Database["public"]["Tables"]["brand_pillars"]["Row"];
type Audience = Database["public"]["Tables"]["audiences"]["Row"];

export function AddContentIdeaButton({ clientId, pillars, audiences }: { clientId: string; pillars: Pillar[]; audiences: Audience[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createContentIdea, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Add idea
      </Button>
      {isOpen && (
        <Modal title="Add content idea" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="idea-title">Title</Label>
              <Input id="idea-title" name="title" required autoFocus autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="idea-pillar">Pillar</Label>
                <Select id="idea-pillar" name="pillar_id" defaultValue="">
                  <option value="">No pillar</option>
                  {pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="idea-audience">Audience</Label>
                <Select id="idea-audience" name="audience_id" defaultValue="">
                  <option value="">No audience</option>
                  {audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <p className="text-xs text-ink-faint">
              Platform versions (LinkedIn, Instagram…) are added when the idea is approved for production.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add idea"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
