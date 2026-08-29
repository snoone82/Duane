"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { portalGetConnectUrl, portalConnectionStatus, type PortalConnection } from "@/lib/actions/portal-social";
import { socialAccountLabel } from "@/lib/format";

/**
 * The client links their own social accounts (Duane's brief). Connection
 * state is asked of the publishing service on load rather than remembered,
 * so an account revoked at the social network shows as disconnected here
 * instead of quietly failing at publish time.
 */
export function ConnectAccounts() {
  const [rows, setRows] = useState<PortalConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpening, startOpening] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();

  const load = () =>
    startRefresh(async () => {
      const result = await portalConnectionStatus();
      if (!result.ok) setError(result.message);
      else {
        setError(null);
        setRows(result.data);
      }
    });

  useEffect(load, []);

  function handleConnect() {
    setError(null);
    startOpening(async () => {
      const result = await portalGetConnectUrl();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // The authorisation page is opened in a new tab so the portal stays
      // put; the link is short-lived, which is why it's fetched on click.
      window.open(result.data, "_blank", "noopener,noreferrer");
    });
  }

  const connectedCount = rows?.filter((row) => row.connected).length ?? 0;

  return (
    <div className="space-y-4">
      {error && <Notice kind="danger">{error}</Notice>}

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Connect your accounts</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Link each social account you&rsquo;d like us to publish to. You&rsquo;ll sign in to each network yourself and
              approve the connection there.
            </p>
          </div>
          <Button variant="primary" onClick={handleConnect} disabled={isOpening}>
            {isOpening ? "Opening…" : rows && connectedCount > 0 ? "Manage connections" : "Connect accounts"}
          </Button>
        </div>

        <p className="mt-3 rounded-md bg-surface-muted/50 px-3 py-2 text-xs text-ink-soft">
          Your social media passwords are not shared with Aligned Media or stored in PBOS. You authorise access directly with
          the social platform, and you can remove that access at any time.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Your accounts</h2>
          <button
            type="button"
            onClick={load}
            disabled={isRefreshing}
            className="text-xs text-accent underline-offset-2 hover:underline disabled:text-ink-faint"
          >
            {isRefreshing ? "Checking…" : "Refresh"}
          </button>
        </div>

        {rows === null ? (
          <p className="text-sm text-ink-faint">Checking your connections…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No accounts set up yet. Use Connect accounts above, or speak to your Aligned Media contact.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li
                key={`${row.platform}-${row.accountId ?? i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-muted/30 px-3 py-2"
              >
                <span className="min-w-0 text-sm text-ink">
                  {socialAccountLabel(row.platform, row.accountName)}
                  {!row.accountId && <span className="ml-2 text-xs text-ink-faint">connected, not yet set up in your plan</span>}
                </span>
                {row.connected ? (
                  <StatusPill label="Connected" color="green" />
                ) : (
                  <StatusPill label="Not connected" color="slate" />
                )}
              </li>
            ))}
          </ul>
        )}

        {rows !== null && rows.some((row) => !row.connected) && (
          <p className="mt-3 text-xs text-ink-faint">
            Anything showing as not connected can be linked with the button above. If an account was connected before and now
            isn&rsquo;t, its access may have expired — reconnecting fixes it.
          </p>
        )}
      </div>
    </div>
  );
}
