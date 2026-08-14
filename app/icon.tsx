import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon, generated from code so it's always in sync with
 * components/ui/Logo.tsx — same peak + dot mark, geometry pixel-measured
 * off the approved brand asset (Aligned Logo 2.png). On its own navy
 * ground here (matching that asset) rather than transparent, so it reads
 * clearly as a small square regardless of browser tab theme. Colours are
 * hand-copied from styles/design-tokens.css (--color-gold,
 * --color-brand-navy) rather than imported: this file renders through
 * Satori/ImageResponse, which can't read CSS custom properties or
 * Tailwind classes.
 */
export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
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
