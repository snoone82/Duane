"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { startPreview } from "@/lib/actions/preview";

export interface PreviewablePerson {
  userId: string;
  name: string;
  role: string;
}

/**
 * Read-only View as User (Duane's brief). Opens this client's portal in a
 * new tab, rendered with the selected person's real permissions — no
 * password, no session swap, and every write refused while it's active.
 */
export function ViewAsUser({ people }: { people: PreviewablePerson[] }) {
  const [selected, setSelected] = useState(people[0]?.userId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (people.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Nobody on this client has a portal login yet. Create one from the Client team panel to preview their view.
      </p>
    );
  }

  function handleView() {
    setError(null);
    startTransition(async () => {
      const result = await startPreview(selected);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // The cookie is set; the new tab renders the portal as them.
      window.open("/portal", "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-2">
      {error && <Notice kind="danger">{error}</Notice>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Label htmlFor="view-as-user">View the portal as</Label>
          <Select id="view-as-user" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {people.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name} — {person.role}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" onClick={handleView} disabled={isPending || !selected}>
          {isPending ? "Opening…" : "View as user →"}
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Opens their portal in a new tab, using their real permissions. Read-only — nothing can be approved, changed, uploaded
        or sent while previewing, and their password is never involved. The preview ends when you exit it, or after two hours.
      </p>
    </div>
  );
}
