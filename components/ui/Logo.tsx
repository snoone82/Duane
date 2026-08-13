/**
 * Small, quiet chrome mark — not a hero element. The approved brand mark: a
 * peak (two converging strokes) with a dot resting at its base, from the
 * supplied logo asset (Aligned Logo 2.png). Geometry below was measured
 * directly off that file (pixel-scanned apex/leg/dot coordinates), not
 * eyeballed, so it reproduces the real mark rather than approximating it.
 * Gold is used here deliberately — the logo is one of the few places the
 * token comments call out as an intentional exception to "gold is not a
 * text colour".
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="20"
        height="20"
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
      <span className="font-heading text-base font-medium leading-none text-gold">
        Aligned
      </span>
    </span>
  );
}
