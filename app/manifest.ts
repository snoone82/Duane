import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes Aligned installable ("Add to Home Screen") on
 * mobile, appropriate for a mobile-first product people fill in on a phone
 * and come back to. Colour values are hand-copied from
 * styles/design-tokens.css (--color-paper, --color-gold): this file returns
 * a plain JSON object outside the CSS/Tailwind token pipeline, so it can't
 * reference the CSS custom properties directly.
 *
 * Icons reuse the app/icon.tsx (favicon) and app/apple-icon.tsx (larger,
 * opaque) routes rather than static files in /public, so there's exactly
 * one place (the peak + dot mark, shared with components/ui/Logo.tsx)
 * that needs updating if the mark ever changes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aligned",
    short_name: "Aligned",
    description:
      "A ten-area life audit that gives you an Alignment Score and gets a human coach looking at your situation.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF9F5", // --color-paper — the app's own light UI, not the icon's navy
    theme_color: "#D3A758", // --color-gold
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
