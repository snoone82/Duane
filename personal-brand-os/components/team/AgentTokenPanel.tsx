"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { createAgentToken, revokeAgentToken } from "@/lib/actions/agent-tokens";
import { formatDateTime } from "@/lib/format";

export interface AgentTokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  scopes: string[];
}

/**
 * Agent tokens, for the ChatGPT / Work integration.
 *
 * The new token is shown once and then never again — not because that is
 * fashionable but because only its hash is stored, so there is genuinely
 * nothing to show later. The copy affordance and the warning are doing real
 * work here: close this without copying and the only remedy is a new token.
 */
export function AgentTokenPanel({ tokens }: { tokens: AgentTokenRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createAgentToken(name);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setFresh(result.data);
      setCopied(false);
      setName("");
      router.refresh();
    });
  }

  function revoke(token: AgentTokenRow) {
    if (!window.confirm(`Revoke "${token.name}"? Anything using it stops working immediately.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeAgentToken(token.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Agent access</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Tokens for automated agents (ChatGPT / Work) to read and update Actions through the PBOS API. Each one is independent
        — revoke a single tool without touching the others.
      </p>

      {error && (
        <div className="mt-3">
          <Notice kind="danger">{error}</Notice>
        </div>
      )}

      {fresh && (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
          <p className="text-xs font-medium text-ink">
            Copy this now — it can&rsquo;t be shown again. PBOS stores only a hash of it.
          </p>
          <code className="mt-1.5 block break-all rounded bg-surface-muted px-2 py-1.5 font-mono text-xs text-ink">
            {fresh}
          </code>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(fresh).then(() => setCopied(true));
              }}
            >
              {copied ? "Copied ✓" : "Copy token"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFresh(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Label htmlFor="agent-token-name">New token name</Label>
          <Input
            id="agent-token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ChatGPT — Duane"
            disabled={isPending}
          />
        </div>
        <Button variant="primary" onClick={create} disabled={isPending || !name.trim()}>
          {isPending ? "Creating…" : "Create token"}
        </Button>
      </div>

      {tokens.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5">
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {token.name}
                  {token.revoked_at && <span className="ml-2 text-xs text-ink-faint">revoked</span>}
                </p>
                <p className="text-xs text-ink-faint">
                  {token.scopes.join(", ")} ·{" "}
                  {token.last_used_at ? `last used ${formatDateTime(token.last_used_at)}` : "never used"}
                </p>
              </div>
              {!token.revoked_at && (
                <Button variant="ghost" size="sm" onClick={() => revoke(token)} disabled={isPending}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
