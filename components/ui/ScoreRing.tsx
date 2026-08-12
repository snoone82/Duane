/**
 * Score display, framed by a ring.
 *
 * Deliberately NOT a "fill" ring: the stroke is a single, complete circle
 * whose weight and colour never change with `value` — no proportional arc,
 * no colour-coding by score tier, no "you're X% there" framing. A ring that
 * fills in proportion to the score reads as an achievement/progress bar,
 * which conflicts with the product rule that a score must never read as a
 * verdict or grade on the person. So this is a static, neutral dial that
 * frames the number — the same visual weight whether the score is 12 or 98.
 */
export function ScoreRing({
  value,
  max,
  size = 160,
}: {
  value: number;
  max: number;
  size?: number;
}) {
  const stroke = size >= 160 ? 3 : 2;
  const radius = size / 2 - stroke * 2;
  const fontSize = size >= 160 ? "var(--text-score)" : "var(--text-3xl)";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Alignment score ${value} out of ${max}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-gold-soft)"
          strokeWidth={stroke}
        />
      </svg>
      <span
        className="absolute font-heading leading-none text-ink"
        style={{ fontSize }}
      >
        {value}
      </span>
    </div>
  );
}
