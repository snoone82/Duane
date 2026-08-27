"use client";

import { useActionState, useEffect, useState } from "react";
import { portalCreateContentIdea, portalUpdateContentIdea } from "@/lib/actions/portal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { formatDate } from "@/lib/format";

/** "Add content idea" for the client (Duane batch 9): title + notes now,
 * editable until the team starts producing it. */
export function AddIdeaButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(portalCreateContentIdea, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setIsOpen(true)}>
        + Add content idea
      </Button>
      {isOpen && (
        <Modal title="Add a content idea" onClose={() => setIsOpen(false)}>
          <form action={formAction} className="space-y-3">
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <p className="text-sm text-ink-soft">
              Anything you&rsquo;d like to say publicly — a story, a lesson, a question you keep being asked. The team
              picks it up from here and shapes it for each platform.
            </p>
            <div>
              <Label htmlFor="idea-title">Title</Label>
              <Input id="idea-title" name="title" required autoFocus autoComplete="off" placeholder="e.g. The mistake I made in year one" />
            </div>
            <div>
              <Label htmlFor="idea-body">Notes / draft copy</Label>
              <Textarea id="idea-body" name="body" rows={5} placeholder="Rough thoughts are fine — bullet points, a paragraph, or the whole post." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Sending…" : "Send to the team"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/** One of the client's own submitted ideas — still editable while it sits
 * in the idea stage. */
export function EditableIdea({
  idea,
}: {
  idea: { id: string; title: string; body: string; created_at: string };
}) {
  return (
    <details className="group rounded-lg border border-border bg-surface px-4 py-3 shadow-md backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{idea.title}</span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            Yours · sent {formatDate(idea.created_at.slice(0, 10))} · still editable
          </span>
        </span>
        <span aria-hidden className="text-xs text-ink-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <AutosaveInput
          id={`idea-title-${idea.id}`}
          label="Title"
          initialValue={idea.title}
          onSave={(value) => portalUpdateContentIdea(idea.id, "title", value)}
        />
        <AutosaveTextarea
          id={`idea-body-${idea.id}`}
          label="Notes / draft copy"
          initialValue={idea.body}
          onSave={(value) => portalUpdateContentIdea(idea.id, "body", value)}
          rows={4}
        />
        <p className="text-xs text-ink-faint">
          Changes save as you type. Once the team starts producing it, this becomes read-only and you&rsquo;ll see it in
          the pipeline below.
        </p>
      </div>
    </details>
  );
}
