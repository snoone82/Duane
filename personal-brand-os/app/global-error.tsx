"use client";

/**
 * Catches errors thrown by the root layout itself — the one place app/error.tsx
 * can't reach, since it replaces the root layout entirely. Has to render its
 * own minimal <html>/<body> and can't rely on the token pipeline having
 * loaded, so colours here are hand-copied from styles/design-tokens.css
 * rather than imported.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#0b1220",
          color: "#e8edf6",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginBottom: 20, fontSize: 14, color: "#a7b1c2" }}>
            The app hit an unexpected error loading. Try again.
          </p>
          <button
            onClick={reset}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              background: "#19b8ce",
              color: "#04141c",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
