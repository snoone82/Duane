import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Larger app icon (Apple touch icon, and reused as the bigger of the two
 * manifest.ts icons for "Add to Home Screen" on Android too) — same
 * spirit-level mark as components/ui/Logo.tsx and app/icon.tsx, rendered
 * bigger with a solid paper backdrop so it reads cleanly on a home screen
 * instead of compositing onto black. Colours hand-copied from
 * styles/design-tokens.css (--color-paper, --color-gold) — see app/icon.tsx
 * for why this file can't read the CSS tokens directly.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FBF9F5",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="8.25" stroke="#B08D3F" strokeWidth="1.5" />
          <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="#B08D3F" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="2" fill="#B08D3F" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
