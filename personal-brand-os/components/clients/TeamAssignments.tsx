"use client";

import { useState, useTransition } from "react";
import { assignTeamMember, unassignTeamMember } from "@/lib/actions/client-assignments";
import { Select, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { AssignedMember, TeamMemberOption } from "@/lib/data/client";

export function TeamAssignments({
  clientId,
  assigned,
  allMembers,
  isAdmin,
}: {
  clientId: string;
  assigned: AssignedMember[];
  allMembers: TeamMemberOption[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const unassignedOptions = allMembers.filter((m) => !assigned.some((a) => a.userId === m.id));

  function handleAssign() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await assignTeamMember(clientId, selected);
      if (!result.ok) setError(result.message);
      else setSelected("");
    });
  }

  function handleUnassign(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this client?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await unassignTeamMember(clientId, userId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div>
      {assigned.length === 0 ? (
        <p className="text-sm text-ink-faint">No one assigned yet — only admins can see this client.</p>
      ) : (
        <ul className="space-y-1.5">
          {assigned.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {member.name} <span className="text-xs capitalize text-ink-faint">({member.role})</span>
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleUnassign(member.userId, member.name)}
                  disabled={isPending}
                  className="text-xs text-ink-faint hover:text-danger"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && unassignedOptions.length > 0 && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="assign-member">Assign someone</Label>
            <Select id="assign-member" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Choose a team member…</option>
              {unassignedOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" onClick={handleAssign} disabled={isPending || !selected}>
            Assign
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
