"use client";

import { useState, useTransition } from "react";
import { setPortalUser, createPortalLogin } from "@/lib/actions/portal";
import { Select, Label, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { TeamMemberOption } from "@/lib/data/client";

export function PortalAccessControl({
  clientId,
  linkedUserId,
  clientAccounts,
  clientEmail,
}: {
  clientId: string;
  linkedUserId: string | null;
  clientAccounts: TeamMemberOption[];
  clientEmail?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [inviteEmail, setInviteEmail] = useState(clientEmail ?? "");
  const [invited, setInvited] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createPortalLogin(clientId, inviteEmail);
      if (!result.ok) setError(result.message);
      else setInvited(inviteEmail.trim().toLowerCase());
    });
  }

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
        {invited && (
          <div className="mb-2">
            <Notice kind="success">
              Portal login created — a set-your-password email is on its way to {invited}. Once they&rsquo;ve set it, they sign
              in at the normal address and land straight in their portal.
            </Notice>
          </div>
        )}
        <p className="text-sm text-ink">
          {linked ? linked.name : invited ?? "A client account"}{" "}
          <span className="text-xs text-ink-faint">can view this client&rsquo;s portal</span>
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

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="portal-invite-email">Create a portal login for this client</Label>
            <Input
              id="portal-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="client@example.com"
              autoComplete="off"
            />
          </div>
          <Button size="sm" variant="primary" onClick={handleCreate} disabled={isPending || !inviteEmail.trim()}>
            {isPending ? "Creating…" : "Create & email them"}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          One click: creates their login, links it to this client, and emails them a link to set their own password.
          They&rsquo;ll see a read-only portal — strategy, priorities, content approvals, progress and meeting summaries.
        </p>
      </div>

      {clientAccounts.length > 0 && (
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="portal-user">Or link an existing client account</Label>
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
        </div>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
