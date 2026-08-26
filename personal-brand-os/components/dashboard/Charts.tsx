/**
 * Server-rendered SVG charts for the dashboard — no chart library, colours
 * validated for colour-vision safety on the dark surface (dataviz six-check
 * validator: the five categorical slots pass adjacency in dark mode).
 * Identity is never colour-alone: every chart pairs marks with a labelled
 * legend or direct value labels in ink tokens.
 */

const RING_TRACK = "rgba(244, 246, 251, 0.08)";

/** Progress-to-target ring: single teal hue, hero number in the centre. */
export function ProgressRing({
  percent,
  centre,
  caption,
}: {
  percent: number;
  centre: string;
  caption: string;
}) {
  const size = 148;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% of target`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_TRACK} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#21c9e0"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" fill="#eef2f9" fontSize="27" fontWeight="300">
          {centre}
        </text>
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" fill="#6e7a8f" fontSize="10.5">
          of target
        </text>
      </svg>
      <p className="text-center text-xs text-ink-faint">{caption}</p>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Categorical donut with 2px surface gaps between segments and a labelled
 * legend carrying the exact counts. */
export function Donut({ segments, centreLabel }: { segments: DonutSegment[]; centreLabel: string }) {
  const size = 148;
  const stroke = 15;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gapPx = visible.length > 1 ? 2.5 : 0;

  let offset = 0;
  const arcs = visible.map((segment) => {
    const share = segment.value / total;
    const length = Math.max(share * c - gapPx, 1.5);
    const arc = { ...segment, dash: length, offset };
    offset += share * c;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centreLabel}>
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${c - arc.dash}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${arc.label}: ${arc.value}`}</title>
          </circle>
        ))}
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fill="#eef2f9" fontSize="26" fontWeight="300">
          {total}
        </text>
        <text x="50%" y="61%" textAnchor="middle" dominantBaseline="central" fill="#6e7a8f" fontSize="10.5">
          {centreLabel}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-ink-soft">
              <span aria-hidden className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: segment.color }} />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="tabular-nums text-ink">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  detail?: string;
  detailDanger?: boolean;
  href?: string;
}

/** Horizontal magnitude bars: one hue, rounded data-ends, values as text. */
export function HBars({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-ink-soft">{item.label}</span>
            <span className="flex-shrink-0 tabular-nums text-ink">
              {item.value}
              {item.detail && (
                <span className={item.detailDanger ? "ml-1.5 text-danger" : "ml-1.5 text-ink-faint"}>{item.detail}</span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%`, background: "#21c9e0" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
