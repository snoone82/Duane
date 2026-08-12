import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon, generated from code so it's always in sync with
 * components/ui/Logo.tsx — same "spirit level" mark (circle + horizontal
 * line + centred bubble). Colours are hand-copied from
 * styles/design-tokens.css (--color-gold) rather than imported: this file
 * renders through Satori/ImageResponse, which can't read CSS custom
 * properties or Tailwind classes.
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
        }}
      >
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="8.25" stroke="#B08D3F" strokeWidth="1.5" />
          <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="#B08D3F" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="2" fill="#B08D3F" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
