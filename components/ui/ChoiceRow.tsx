/** A row of pill buttons acting as a single-select radiogroup — shared by the CLEAR goal step and the standalone "add a supporting goal" form so the two stay visually identical. */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-[var(--tap-target-min)] rounded-full border-2 px-4 font-body text-sm transition-colors duration-[var(--duration-fast)] ${
              selected
                ? "border-gold bg-gold text-gold-ink font-semibold"
                : "border-border-strong bg-paper-raised text-ink hover:border-gold"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
