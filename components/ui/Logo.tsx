/**
 * Small, quiet chrome mark — not a hero element. A "spirit level" motif
 * (circle + horizontal line + centered bubble) literal to the product name:
 * a level only reads as balanced when its bubble sits dead-centre, which is
 * exactly what "Aligned" is about. Gold is used here deliberately — the
 * logo is one of the few places the token comments call out as an
 * intentional exception to "gold is not a text colour".
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="10" cy="10" r="8.25" stroke="var(--color-gold)" strokeWidth="1.5" />
        <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="var(--color-gold)" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="2" fill="var(--color-gold)" />
      </svg>
      <span className="font-heading text-base font-medium leading-none text-gold">
        Aligned
      </span>
    </span>
  );
}
