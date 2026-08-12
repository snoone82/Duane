type Point = { label: string; value: number };

const SIZE = 420;
const CENTER = SIZE / 2;
const RADIUS = 150;
const MAX_VALUE = 10;
const RINGS = [2, 4, 6, 8, 10];

function pointOnCircle(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

export function RadarChart({ points }: { points: Point[] }) {
  const count = points.length;
  if (count < 3) return null;

  const polygon = points
    .map((p, i) => {
      const r = (Math.max(0, Math.min(p.value, MAX_VALUE)) / MAX_VALUE) * RADIUS;
      const { x, y } = pointOnCircle(i, count, r);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Radar chart showing your satisfaction score across all ten areas"
      className="mx-auto w-full max-w-md"
    >
      {/* Reference rings */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={points
            .map((_, i) => {
              const { x, y } = pointOnCircle(i, count, (ring / MAX_VALUE) * RADIUS);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}

      {/* Spokes */}
      {points.map((_, i) => {
        const { x, y } = pointOnCircle(i, count, RADIUS);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        );
      })}

      {/* Score polygon */}
      <polygon points={polygon} fill="var(--color-gold-soft)" fillOpacity={0.6} stroke="var(--color-gold)" strokeWidth={2} />
      {points.map((p, i) => {
        const r = (Math.max(0, Math.min(p.value, MAX_VALUE)) / MAX_VALUE) * RADIUS;
        const { x, y } = pointOnCircle(i, count, r);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--color-gold-strong)" />;
      })}

      {/* Labels */}
      {points.map((p, i) => {
        const { x, y } = pointOnCircle(i, count, RADIUS + 26);
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        const cos = Math.cos(angle);
        const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--color-ink-soft)"
            fontFamily="var(--font-body)"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
