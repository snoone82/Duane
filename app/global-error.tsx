"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (app/layout.tsx) — the one
 * place app/error.tsx can't reach, because that boundary renders *inside*
 * the root layout. This file replaces the whole document when it triggers,
 * so it must render its own <html>/<body> and can't assume app/globals.css
 * or styles/design-tokens.css loaded successfully.
 *
 * Colours below are hand-copied from styles/design-tokens.css
 * (--color-paper, --color-ink, --color-ink-soft, --color-gold,
 * --color-gold-ink, --color-border-strong) rather than imported, since this
 * boundary exists precisely for the case where the normal app shell — and
 * whatever loads the token pipeline — didn't render. Kept deliberately
 * simple, but still calm and on-brand rather than a raw stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
          background: "#FBF9F5",
          color: "#1B1812",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#D3A758",
          }}
        >
          Aligned
        </p>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Something went wrong on our end</h1>
        <p style={{ margin: 0, maxWidth: "28rem", lineHeight: 1.6, color: "#55503F" }}>
          That&rsquo;s on us, not you — nothing you&rsquo;d already saved is lost. Try
          reloading, and if it keeps happening, come back in a few minutes.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.625rem",
              border: "none",
              background: "#D3A758",
              color: "#241D0C",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate:
              this boundary replaces the root layout, so it must not depend on
              Next's client router (which <Link> requires) that may itself be
              part of what just failed. A plain full-page navigation is the
              correct, more robust choice here specifically. */}
          <a
            href="/"
            style={{
              minHeight: "2.75rem",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 1.5rem",
              borderRadius: "0.625rem",
              border: "1px solid #C9C2AC",
              color: "#1B1812",
              textDecoration: "none",
            }}
          >
            Go to the start
          </a>
        </div>
      </body>
    </html>
  );
}
