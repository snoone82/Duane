/**
 * Publish-date scheduling for a Monthly Plan — pure and deterministic, so it
 * can be reasoned about (and exercised) without a database.
 *
 * Duane's rules after the first full run (Sept 2026):
 *   1. Each account publishes on its own posting days (ISO 1 = Mon … 7 =
 *      Sun; default Mon–Fri). Never a Daniel-specific rule.
 *   2. Spread each account's outputs evenly across those days, in Master
 *      Content sequence order.
 *   3. Never more than one post per account per day. If the month has fewer
 *      posting days than outputs, spill onto the account's other days first;
 *      only double up when every day of the month is taken.
 *   4. Two outputs under the SAME Master Content idea in the same platform
 *      family (e.g. LinkedIn — Daniel Andrews and LinkedIn — CEG) are kept
 *      at least `siblingGapDays` apart, without breaking rule 3.
 */

export const DEFAULT_POSTING_DAYS = [1, 2, 3, 4, 5];

export const WEEKDAYS: { value: number; label: string; long: string }[] = [
  { value: 1, label: "Mon", long: "Monday" },
  { value: 2, label: "Tue", long: "Tuesday" },
  { value: 3, label: "Wed", long: "Wednesday" },
  { value: 4, label: "Thu", long: "Thursday" },
  { value: 5, label: "Fri", long: "Friday" },
  { value: 6, label: "Sat", long: "Saturday" },
  { value: 7, label: "Sun", long: "Sunday" },
];

/** "Mon, Tue, Wed" — or "Every day". */
export function postingDaysLabel(days: number[] | null | undefined): string {
  const valid = normalisePostingDays(days);
  if (valid.length === 7) return "Every day";
  return WEEKDAYS.filter((d) => valid.includes(d.value))
    .map((d) => d.label)
    .join(", ");
}

/** Sorted, de-duplicated, 1–7 only; falls back to the default when empty. */
export function normalisePostingDays(days: number[] | null | undefined): number[] {
  const valid = [...new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  return valid.length > 0 ? valid : [...DEFAULT_POSTING_DAYS];
}

export interface SchedulableOutput {
  id: string;
  /** The Master Content idea this output belongs to. */
  contentId: string;
  /** Publishing account; null means it can't be dated (counted as skipped). */
  accountId: string | null;
  /** Platform family key (e.g. "linkedin"), used for the sibling rule. */
  family: string;
  /** Parent idea's plan_sequence — ordering within the month. */
  sequence: number;
}

export interface ScheduleInput {
  year: number;
  /** 1–12 */
  month: number;
  outputs: SchedulableOutput[];
  /** Posting days per account id. Missing account → default days. */
  postingDaysByAccount: Map<string, number[]>;
  siblingGapDays?: number;
}

export interface ScheduleResult {
  /** Day-of-month per output id. */
  dayByOutput: Map<string, number>;
  /** Outputs with no account, left undated. */
  skipped: number;
  /** Outputs placed on a day outside the account's posting days. */
  offPreferredDays: number;
  /** Outputs that had to share a day with another post on the same account. */
  doubledUp: number;
}

function isoWeekday(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function schedulePlanOutputs(input: ScheduleInput): ScheduleResult {
  const { year, month, outputs } = input;
  const gap = input.siblingGapDays ?? 2;
  const totalDays = daysInMonth(year, month);
  const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  const dayByOutput = new Map<string, number>();
  const usedByAccount = new Map<string, Set<number>>();
  const preferredByAccount = new Map<string, Set<number>>();
  let skipped = 0;
  let offPreferredDays = 0;
  let doubledUp = 0;

  const byAccount = new Map<string, SchedulableOutput[]>();
  for (const output of outputs) {
    if (!output.accountId) {
      skipped += 1;
      continue;
    }
    const list = byAccount.get(output.accountId) ?? [];
    list.push(output);
    byAccount.set(output.accountId, list);
  }

  // Primary pass: even spread per account across its posting days.
  for (const [accountId, group] of byAccount) {
    const preferredWeekdays = normalisePostingDays(input.postingDaysByAccount.get(accountId));
    const preferredDays = allDays.filter((d) => preferredWeekdays.includes(isoWeekday(year, month, d)));
    const otherDays = allDays.filter((d) => !preferredWeekdays.includes(isoWeekday(year, month, d)));
    preferredByAccount.set(accountId, new Set(preferredDays));
    const used = new Set<number>();
    usedByAccount.set(accountId, used);

    group.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
    const n = group.length;

    // Pool of candidate days, one slot each: posting days first, then the
    // rest of the month only if the posting days alone can't fit the volume.
    let pool = preferredDays;
    if (n > pool.length) {
      pool = [...preferredDays, ...otherDays].sort((a, b) => a - b);
      offPreferredDays += Math.min(n, pool.length) - preferredDays.length;
    }

    if (n <= pool.length) {
      // floor(step * (i + 0.5)) is strictly increasing for step >= 1, so
      // every output lands on a distinct day and the spread stays even.
      const step = pool.length / n;
      group.forEach((output, i) => {
        const day = pool[Math.floor(step * (i + 0.5))]!;
        dayByOutput.set(output.id, day);
        used.add(day);
      });
    } else {
      // More outputs than days in the month: cycle, and count the overlap.
      group.forEach((output, i) => {
        const day = pool[i % pool.length]!;
        if (used.has(day)) doubledUp += 1;
        dayByOutput.set(output.id, day);
        used.add(day);
      });
    }
  }

  // Sibling pass: same idea + same platform family → keep them apart, moving
  // the later one to the next free day for ITS account (posting days first).
  const byIdeaFamily = new Map<string, SchedulableOutput[]>();
  for (const output of outputs) {
    if (!dayByOutput.has(output.id)) continue;
    const key = `${output.contentId}:${output.family}`;
    const list = byIdeaFamily.get(key) ?? [];
    list.push(output);
    byIdeaFamily.set(key, list);
  }
  // Walk groups in Master Content order (then key) so the result never
  // depends on the order outputs were handed in — moving one sibling
  // changes which days are free for the next.
  const orderedGroups = [...byIdeaFamily.entries()]
    .map(([key, group]) => ({ key, group, sequence: Math.min(...group.map((o) => o.sequence)) }))
    .sort((a, b) => a.sequence - b.sequence || a.key.localeCompare(b.key))
    .map((g) => g.group);
  for (const group of orderedGroups) {
    if (group.length < 2) continue;
    group.sort((a, b) => dayByOutput.get(a.id)! - dayByOutput.get(b.id)! || a.id.localeCompare(b.id));
    let prevDay = dayByOutput.get(group[0]!.id)!;
    for (let i = 1; i < group.length; i++) {
      const current = group[i]!;
      const currentDay = dayByOutput.get(current.id)!;
      if (currentDay - prevDay >= gap) {
        prevDay = currentDay;
        continue;
      }
      const accountId = current.accountId!;
      const used = usedByAccount.get(accountId)!;
      const preferred = preferredByAccount.get(accountId)!;
      const earliest = prevDay + gap;
      const candidates = allDays.filter((d) => d >= earliest && d !== currentDay && !used.has(d));
      const target = candidates.find((d) => preferred.has(d)) ?? candidates[0];
      if (target === undefined) {
        // Nowhere to move it without breaking one-per-day — leave as is.
        prevDay = currentDay;
        continue;
      }
      used.delete(currentDay);
      used.add(target);
      dayByOutput.set(current.id, target);
      if (!preferred.has(target) && preferred.has(currentDay)) offPreferredDays += 1;
      prevDay = target;
    }
  }

  return { dayByOutput, skipped, offPreferredDays, doubledUp };
}
