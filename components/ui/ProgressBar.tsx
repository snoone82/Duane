export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);

  return (
    <div>
      <p className="label-caps mb-2 text-xs text-ink-soft">
        {current} of {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        className="h-2 w-full overflow-hidden rounded-full bg-paper-muted"
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-standard)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
