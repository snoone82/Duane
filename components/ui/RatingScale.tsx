"use client";

/**
 * Two visually distinct rating styles are used deliberately: satisfaction
 * (1-10) renders as a dense number grid, importance (1-5) renders as a row
 * of wide pills. Same scale, same layout as two stacked ten-point rows would
 * get mis-answered — this makes them read as two different questions.
 */
type Variant = "grid" | "pills";

export function RatingScale({
  min,
  max,
  value,
  onChange,
  variant,
  name,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
  variant: Variant;
  name: string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  if (variant === "pills") {
    // Importance (1-5): fewer, coarser choices — a bolder, heavier-weight
    // selection (solid gold fill, thicker border, semibold) so it reads as
    // the more emphatic of the two question types.
    return (
      <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
        {options.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(n)}
              className={`min-h-[var(--tap-target-min)] min-w-[var(--tap-target-min)] flex-1 rounded-full border-2 px-3 font-heading text-lg transition-colors duration-[var(--duration-fast)] ${
                selected
                  ? "border-gold bg-gold text-gold-ink font-semibold"
                  : "border-border-strong bg-paper-raised text-ink hover:border-gold"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  // Satisfaction (1-10): a dense grid of many choices — a quieter, lighter
  // tint on selection (soft gold background, thin border, regular weight)
  // rather than a solid fill, so it doesn't compete visually with the
  // bolder pill row above and the two question types stay easy to tell apart.
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="grid grid-cols-5 gap-2 sm:grid-cols-10"
    >
      {options.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(n)}
            className={`min-h-[var(--tap-target-min)] min-w-[var(--tap-target-min)] rounded-md border font-heading text-base transition-colors duration-[var(--duration-fast)] ${
              selected
                ? "border-gold bg-gold-soft text-gold-strong"
                : "border-border bg-paper-raised text-ink hover:border-gold"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
