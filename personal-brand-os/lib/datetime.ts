/**
 * One timezone for the whole app: Europe/London.
 *
 * Duane: "if I enter 08:00 UK local time, every PBOS screen and the time
 * ultimately passed to Ayrshare should represent the same intended 08:00 UK
 * local publication time. There should be no hidden +1/-1 hour conversion."
 *
 * The bug this replaces: a <input type="datetime-local"> yields a bare wall
 * clock — "2026-09-28T08:00", no offset — and that string was being handed to
 * a SERVER action which did `new Date(value)`. An offset-less string is
 * parsed as the PARSER's local time, and the server runs in UTC, so 08:00 UK
 * was stored as 08:00Z, which is 09:00 UK. Reopening the row rendered 09:00,
 * and saving again would have stored 09:00Z — drifting an hour every round
 * trip rather than being wrong once.
 *
 * Pinned to London rather than to the browser's zone deliberately. The
 * business publishes on UK time; if someone opens PBOS from another country,
 * 08:00 should still mean 08:00 in London, not 08:00 where they happen to be
 * standing. It also makes the server and the browser agree, which a
 * browser-relative approach cannot do during server rendering.
 */

export const APP_TIME_ZONE = "Europe/London";

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The London wall clock for a given instant, as numbers. */
function londonParts(instant: Date) {
  const parts = Object.fromEntries(PARTS.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** How far London is ahead of UTC at a given instant, in minutes (0 or 60). */
function londonOffsetMinutes(instant: Date): number {
  const p = londonParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * "2026-09-28T08:00" (London wall clock) → "2026-09-28T07:00:00.000Z".
 *
 * Two passes, because the offset depends on the very instant being computed.
 * The first guess treats the wall clock as UTC and asks what London's offset
 * was around then; the second re-checks at the corrected instant, which is
 * what makes the hour on either side of a DST change come out right.
 */
export function londonInputToIso(value: string): string | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const wallClockAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));

  let offset = londonOffsetMinutes(new Date(wallClockAsUtc));
  let instant = wallClockAsUtc - offset * 60_000;
  const settled = londonOffsetMinutes(new Date(instant));
  if (settled !== offset) {
    offset = settled;
    instant = wallClockAsUtc - offset * 60_000;
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

/** The inverse: an instant → the London wall clock a datetime-local wants. */
export function isoToLondonInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const p = londonParts(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Parse a date and time arriving from anywhere in the app.
 *
 * A string carrying its own offset is honoured. A bare wall clock —
 * everything a <input type="datetime-local"> produces — is read as London
 * rather than as the runtime's zone. That single rule is the fix: it holds
 * for a server action called from the browser AND for a plain form post,
 * where there is no opportunity to convert client-side at all.
 *
 * Returns null for anything unparseable, so callers keep their own wording.
 */
export function parseAppDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  if (hasOffset) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = londonInputToIso(trimmed);
  return iso ? new Date(iso) : null;
}
