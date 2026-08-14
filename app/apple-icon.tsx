import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Larger app icon (Apple touch icon, and reused as the bigger of the two
 * manifest.ts icons for "Add to Home Screen" on Android too) — same peak +
 * dot mark as components/ui/Logo.tsx and app/icon.tsx, on the brand's own
 * navy ground (matching the approved logo asset, Aligned Logo 2.png)
 * rather than the app's light paper background, so the home-screen icon
 * matches the brand mark exactly rather than a re-tinted variant. Colours
 * hand-copied from styles/design-tokens.css (--color-brand-navy,
 * --color-gold) — see app/icon.tsx for why this file can't read the CSS
 * tokens directly.
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
          background: "#100F18",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline
            points="31.5,57 50,21 69,57"
            stroke="#D3A758"
            strokeWidth="9"
            strokeLinecap="square"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="53" r="7" fill="#D3A758" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
