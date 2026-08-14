"use client";

import { useActionState, useState } from "react";
import { createAction } from "@/lib/actions/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * The "create four actions from a consultation without leaving the page"
 * flow from the brief's "what good looks like" — title + optional due date,
 * submit, form clears and stays put for the next one.
 */
export function QuickAddActionForm({ clientId, consultationId }: { clientId: string; consultationId: string }) {
  const [key, setKey] = useState(0);
  const [state, formAction, isPending] = useActionState(createAction, null);

  return (
    <form
      key={key}
      action={async (formData) => {
        formData.set("client_id", clientId);
        formData.set("consultation_id", consultationId);
        await formAction(formData);
        setKey((k) => k + 1);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="min-w-[10rem] flex-1">
        <Input name="title" placeholder="New action…" required aria-label="New action title" className="h-8 text-sm" />
      </div>
      <Input name="due_date" type="date" aria-label="Due date" className="h-8 w-36 text-sm" />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding…" : "+ Add action"}
      </Button>
      {state && !state.ok && <span className="w-full text-xs text-danger">{state.message}</span>}
    </form>
  );
}
