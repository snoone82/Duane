/**
 * The approved brand mark: a peak (two converging strokes) with a dot
 * resting at its base, from the supplied logo asset (Aligned Logo 2.png).
 * Geometry below was measured directly off that file (pixel-scanned
 * apex/leg/dot coordinates), not eyeballed, so it reproduces the real mark
 * rather than approximating it. Gold is used here deliberately — the logo
 * is one of the few places the token comments call out as an intentional
 * exception to "gold is not a text colour".
 *
 * Two sizes, one source of truth:
 * - "sm" (default) — quiet chrome for the task screens (audit questions,
 *   forms). A giant logo repeated on every rating screen would compete
 *   with what someone's actually trying to do there.
 * - "lg" — the hero treatment for the landing page: this is the first
 *   thing anyone sees, so the mark should lead, not sit in a corner.
 */
export function Logo({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "lg";
}) {
  const isLarge = size === "lg";
  const iconSize = isLarge ? 56 : 20;

  return (
    <span
      className={`inline-flex items-center ${isLarge ? "flex-col gap-3" : "gap-2"} ${className}`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <polyline
          points="31.5,57 50,21 69,57"
          stroke="var(--color-gold)"
          strokeWidth="9"
          strokeLinecap="square"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="53" r="7" fill="var(--color-gold)" />
      </svg>
      <span
        className={
          isLarge
            ? "font-heading text-2xl font-semibold leading-none tracking-wide text-gold"
            : "font-heading text-base font-medium leading-none text-gold"
        }
      >
        Aligned
      </span>
    </span>
  );
}
