"use client";

import { useState, useTransition } from "react";
import { setPortalUser } from "@/lib/actions/portal";
import { Select, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { TeamMemberOption } from "@/lib/data/client";

export function PortalAccessControl({
  clientId,
  linkedUserId,
  clientAccounts,
}: {
  clientId: string;
  linkedUserId: string | null;
  clientAccounts: TeamMemberOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const linked = clientAccounts.find((a) => a.id === linkedUserId);

  function handleLink() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await setPortalUser(clientId, selected);
      if (!result.ok) setError(result.message);
      else setSelected("");
    });
  }

  function handleUnlink() {
    if (!window.confirm("Remove this account's portal access?")) return;
    setError(null);
    startTransition(async () => {
      const result = await setPortalUser(clientId, null);
      if (!result.ok) setError(result.message);
    });
  }

  if (linkedUserId) {
    return (
      <div>
        <p className="text-sm text-ink">
          {linked ? linked.name : "A client account"} <span className="text-xs text-ink-faint">can view this client&rsquo;s portal</span>
        </p>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={isPending}
          className="mt-1 text-xs text-ink-faint hover:text-danger"
        >
          Remove portal access
        </button>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (clientAccounts.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No client accounts exist yet. Invite the client in Supabase (Authentication → Users), set their profile role to
        &ldquo;client&rdquo;, then link them here.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="portal-user">Give a client account access</Label>
          <Select id="portal-user" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose an account…</option>
            {clientAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" onClick={handleLink} disabled={isPending || !selected}>
          Link
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">They&rsquo;ll see a read-only portal: strategy, priorities, content, progress and meeting summaries.</p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
