"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import {
  createConnectionProfile,
  getConnectionLinkUrl,
  getConnectionStatus,
  deleteConnectionProfile,
} from "@/lib/actions/publishing";

export interface ConnectionProfile {
  id: string;
  title: string;
}

/** The Social tab's publishing connections panel: one Ayrshare profile per
 * identity (Daniel Andrews, CEG…). "Link accounts" opens the branded
 * Ayrshare page where the owner authorises their socials — we never see or
 * store their passwords. */
export function AyrshareConnections({
  clientId,
  profiles,
  isAdmin,
}: {
  clientId: string;
  profiles: ConnectionProfile[];
  isAdmin: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(createConnectionProfile, null);

  useEffect(() => {
    if (state?.ok) setIsAdding(false);
  }, [state]);

  return (
    <section className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Publishing connections</h2>
        {isAdmin && (
          <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
            + New connection
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-faint">
        One connection per identity (the person or brand). Link its real social logins once, then choose it on each
        account below — content publishes through it automatically.
      </p>

      {profiles.length === 0 ? (
        <p className="text-sm text-ink-faint">No connections yet.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((profile) => (
            <ConnectionRow key={profile.id} clientId={clientId} profile={profile} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      {isAdding && (
        <Modal title="New publishing connection" onClose={() => setIsAdding(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="conn-title">Identity name</Label>
              <Input id="conn-title" name="title" required autoFocus autoComplete="off" placeholder="e.g. Daniel Andrews, CEG" />
            </div>
            <p className="text-xs text-ink-faint">
              A connection holds one linked account per network — so &ldquo;Daniel Andrews&rdquo; (his LinkedIn + his
              Instagram) and &ldquo;CEG&rdquo; (its LinkedIn + Instagram) are two connections.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Creating…" : "Create connection"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function ConnectionRow({ clientId, profile, isAdmin }: { clientId: string; profile: ConnectionProfile; isAdmin: boolean }) {
  const [isBusy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string[] | null>(null);

  function openLinkPage() {
    setError(null);
    startTransition(async () => {
      const result = await getConnectionLinkUrl(clientId, profile.id);
      if (!result.ok) setError(result.message);
      else if (result.data) window.open(result.data, "_blank", "noopener");
    });
  }

  function checkLinked() {
    setError(null);
    startTransition(async () => {
      const result = await getConnectionStatus(clientId, profile.id);
      if (!result.ok) setError(result.message);
      else setLinked(result.data ?? []);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove the "${profile.title}" connection? Accounts pointing at it will stop publishing until reassigned.`)) return;
    startTransition(async () => {
      const result = await deleteConnectionProfile(clientId, profile.id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <li className="rounded-md border border-border bg-surface-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{profile.title}</span>
        <span className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={openLinkPage} disabled={isBusy}>
              Link social accounts →
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={checkLinked} disabled={isBusy}>
            {isBusy ? "…" : "Check linked"}
          </Button>
          {isAdmin && (
            <button type="button" onClick={handleDelete} disabled={isBusy} className="text-xs text-ink-faint hover:text-danger">
              Remove
            </button>
          )}
        </span>
      </div>
      {linked !== null && (
        <p className="mt-1 text-xs text-ink-soft">
          {linked.length > 0 ? `Linked: ${linked.join(", ")}` : "Nothing linked yet — use “Link social accounts”."}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  );
}
