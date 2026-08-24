"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addClientMember,
  updateClientMemberField,
  setClientMemberStatus,
  toggleClientMemberPermission,
  toggleClientMemberAssignable,
  deleteClientMember,
  createClientMemberLogin,
} from "@/lib/actions/client-team";
import { CLIENT_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS, readPermissions } from "@/lib/client-team-permissions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { InlineEditText } from "@/components/ui/InlineEditText";
import type { Database } from "@/lib/database.types";
import type { TagColor } from "@/lib/status";

type Member = Database["public"]["Tables"]["client_members"]["Row"];

const STATUS_META: Record<string, { label: string; color: TagColor }> = {
  invited: { label: "Invited", color: "amber" },
  active: { label: "Active", color: "green" },
  disabled: { label: "Disabled", color: "red" },
};

/** Duane Part A: the Client Team — client-scoped people (Daniel, Charlie)
 * with portal access, permissions and assignable Actions. Strictly separate
 * from Aligned Media's internal team. */
export function ClientTeamPanel({ clientId, members, isAdmin }: { clientId: string; members: Member[]; isAdmin: boolean }) {
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(addClientMember, null);

  useEffect(() => {
    if (state?.ok) setIsAdding(false);
  }, [state]);

  return (
    <div className="space-y-2">
      {members.length === 0 ? (
        <p className="text-sm text-ink-faint">
          No client-side team members yet. Add the client themselves and anyone at their organisation who should have
          portal access or be assignable actions.
        </p>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <MemberCard key={member.id} clientId={clientId} member={member} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
        + Add team member
      </Button>

      {isAdding && (
        <Modal title="Add client team member" onClose={() => setIsAdding(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="member-name">Name</Label>
                <Input id="member-name" name="name" required autoFocus autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="member-email">Email</Label>
                <Input id="member-email" name="email" type="email" autoComplete="off" placeholder="For their portal login" />
              </div>
              <div>
                <Label htmlFor="member-org">Organisation</Label>
                <Input id="member-org" name="organisation" autoComplete="off" placeholder="e.g. CEG" />
              </div>
              <div>
                <Label htmlFor="member-job">Job title / role</Label>
                <Input id="member-job" name="job_title" autoComplete="off" />
              </div>
            </div>
            <div>
              <Label htmlFor="member-role">Client role</Label>
              <Input id="member-role" name="member_role" autoComplete="off" placeholder="e.g. Principal / Client, CEG team member" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="can_be_assigned" defaultChecked className="accent-[--color-accent]" />
              Can be assigned Actions
            </label>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-ink-soft">Portal permissions</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {CLIENT_PERMISSIONS.map((perm) => (
                  <label key={perm.key} className="flex items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name={`perm_${perm.key}`}
                      defaultChecked={DEFAULT_MEMBER_PERMISSIONS[perm.key]}
                      className="mt-0.5 accent-[--color-accent]"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MemberCard({ clientId, member, isAdmin }: { clientId: string; member: Member; isAdmin: boolean }) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const permissions = readPermissions(member.permissions);
  const status = STATUS_META[member.status] ?? STATUS_META.active!;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, successNotice?: string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message ?? "Something went wrong.");
      else if (successNotice) setNotice(successNotice);
    });
  };

  function handleDelete() {
    if (!window.confirm(`Remove ${member.name} from this client's team? Their assigned actions keep their name.`)) return;
    run(() => deleteClientMember(clientId, member.id));
  }

  return (
    <li className="rounded-lg border border-border bg-surface-muted/40">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="min-w-0">
            <span className="text-sm font-medium text-ink">{member.name}</span>
            {(member.job_title || member.organisation) && (
              <span className="ml-2 text-xs text-ink-faint">
                {[member.job_title, member.organisation].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1.5">
            {member.user_id && <StatusPill label="Portal login" color="teal" />}
            <StatusPill label={status.label} color={status.color} />
          </span>
        </summary>
        <div className="space-y-3 border-t border-border px-3 py-3">
          {error && <Notice kind="danger">{error}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["name", "Name", member.name],
                ["email", "Email", member.email],
                ["organisation", "Organisation", member.organisation],
                ["job_title", "Job title", member.job_title],
                ["member_role", "Client role", member.member_role],
              ] as const
            ).map(([field, label, value]) => (
              <div key={field}>
                <p className="mb-0.5 text-xs text-ink-faint">{label}</p>
                <InlineEditText
                  initialValue={value}
                  onSave={(next) => updateClientMemberField(clientId, member.id, field, next)}
                  ariaLabel={`${label} for ${member.name}`}
                  placeholder="—"
                />
              </div>
            ))}
            <div>
              <p className="mb-0.5 text-xs text-ink-faint">Access status</p>
              <Select
                value={member.status}
                aria-label={`Access status for ${member.name}`}
                onChange={(e) => run(() => setClientMemberStatus(clientId, member.id, e.target.value))}
              >
                <option value="invited">Invited</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={member.can_be_assigned}
              className="accent-[--color-accent]"
              onChange={(e) => run(() => toggleClientMemberAssignable(clientId, member.id, e.target.checked))}
            />
            Can be assigned Actions
          </label>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-ink-soft">Portal permissions</legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {CLIENT_PERMISSIONS.map((perm) => (
                <label key={perm.key} className="flex items-start gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={permissions[perm.key] === true}
                    className="mt-0.5 accent-[--color-accent]"
                    onChange={(e) => run(() => toggleClientMemberPermission(clientId, member.id, perm.key, e.target.checked))}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2">
            {isAdmin && !member.user_id && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  run(
                    () => createClientMemberLogin(clientId, member.id),
                    "Login created — they've been emailed a link to set their password."
                  )
                }
              >
                {isBusy ? "Working…" : "Create portal login & email them"}
              </Button>
            )}
            {member.user_id && (
              <p className="text-xs text-ink-faint">
                Portal login linked — they sign in at the normal sign-in page and see only this client.
              </p>
            )}
            <button type="button" onClick={handleDelete} disabled={isBusy} className="ml-auto text-xs text-ink-faint hover:text-danger">
              Remove from team
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}
