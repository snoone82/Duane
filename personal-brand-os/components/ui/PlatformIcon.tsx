/**
 * Recognisable social platform marks.
 *
 * Duane, on the client-facing approval view: "[LinkedIn icon] Daniel
 * Andrews / Video" rather than "LinkedIn — Daniel Andrews · Video". A
 * client scanning what is going where reads a logo far faster than a word.
 *
 * Inline SVG rather than an icon package: these are six shapes, they need
 * to carry their own brand colour, and the app ships no icon dependency.
 * Each mark is drawn in the platform's own brand colour on a tinted chip,
 * which is what makes them scannable at a glance.
 */

export type PlatformSlug = "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube" | "x" | "other";

/**
 * Free-text platform name → known mark. Platform names in PBOS are typed by
 * hand ("X (Twitter)", "Podcast / YouTube / Long-form Video"), so this
 * matches loosely and falls back rather than guessing wrong.
 */
export function platformSlug(platform: string): PlatformSlug {
  const p = platform.trim().toLowerCase();
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("instagram") || p === "ig") return "instagram";
  if (p.includes("facebook") || p === "fb") return "facebook";
  if (p.includes("tiktok") || p.includes("tik tok")) return "tiktok";
  if (p.includes("youtube") || p.includes("you tube")) return "youtube";
  // "X" alone, or any twitter spelling. Checked last so "X" doesn't win
  // against a longer name that happens to contain the letter.
  if (p.includes("twitter") || p === "x" || p.startsWith("x (") || p.startsWith("x —") || p.startsWith("x -")) return "x";
  return "other";
}

/** Brand colour per mark, used for the glyph and a tint behind it. */
const BRAND: Record<PlatformSlug, string> = {
  linkedin: "#0A66C2",
  instagram: "#E1306C",
  facebook: "#1877F2",
  tiktok: "#111111",
  youtube: "#FF0000",
  x: "#111111",
  other: "#6d7c94",
};

export function platformBrandColor(platform: string): string {
  return BRAND[platformSlug(platform)];
}

/** Paths are drawn on a 24×24 grid and filled with currentColor. */
function Glyph({ slug }: { slug: PlatformSlug }) {
  switch (slug) {
    case "linkedin":
      return (
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
      );
    case "instagram":
      return (
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.41a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
      );
    case "facebook":
      return (
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
      );
    case "tiktok":
      return (
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .76-5.07v-3.1a5.66 5.66 0 0 0-.76-.05A5.68 5.68 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z" />
      );
    case "youtube":
      return (
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
      );
    case "x":
      return (
        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z" />
      );
    default:
      // A neutral globe-ish mark for platforms with no logo of their own
      // (podcast feeds, newsletters, "Long-form video").
      return (
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14A7.9 7.9 0 0 1 4 12c0-.69.1-1.36.26-2h3.38a16.5 16.5 0 0 0 0 4H4.26zm.81 2h2.95c.33 1.27.8 2.47 1.38 3.56A8.03 8.03 0 0 1 5.07 16zm2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A13.9 13.9 0 0 1 12 19.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.26 5.56c.58-1.09 1.05-2.29 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
      );
  }
}

/**
 * The platform's mark on a tinted chip. Decorative by default — the
 * platform name is always written alongside it, so screen readers get the
 * name rather than a duplicate label.
 */
export function PlatformIcon({
  platform,
  size = "md",
  className = "",
}: {
  platform: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const slug = platformSlug(platform);
  const box = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-9 w-9" : "h-7 w-7";
  const glyph = size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const color = BRAND[slug];

  return (
    <span
      aria-hidden
      className={`inline-flex ${box} flex-none items-center justify-center rounded-md ${className}`}
      // Brand colours can't come from the design tokens — they belong to
      // the platforms, not to us. Tinted at 12% so six of them in a row
      // stay calm rather than shouting.
      style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className={glyph}>
        <Glyph slug={slug} />
      </svg>
    </span>
  );
}

/** Just the marks, for the collapsed row: "what's this going to?" at a
 * glance. Duplicates are collapsed — two LinkedIn accounts show one mark. */
export function PlatformIconRow({ platforms, className = "" }: { platforms: string[]; className?: string }) {
  const seen: string[] = [];
  for (const platform of platforms) {
    const slug = platformSlug(platform);
    if (!seen.includes(slug)) seen.push(slug);
  }
  if (seen.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {seen.map((slug) => (
        <PlatformIcon key={slug} platform={slug} size="sm" />
      ))}
    </span>
  );
}
