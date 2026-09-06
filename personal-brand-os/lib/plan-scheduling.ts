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
 *   5. (After the second full run) Sibling-constrained outputs are placed
 *      FIRST, against the pool of free posting days, searching both ways
 *      from their ideal slot — then single-platform outputs fill the gaps.
 *      Nudging siblings only forwards collapsed the last groups of the
 *      month onto one day. If a group still can't be spaced, it is
 *      counted and surfaced, never silently relaxed.
 */

export const SIBLING_GAP_DAYS = 2;

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
  /** Sibling groups (same idea, same platform family) that could not be
   * kept `siblingGapDays` apart within the month — surfaced as a warning. */
  unspacedSiblingGroups: number;
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
  const gap = input.siblingGapDays ?? SIBLING_GAP_DAYS;
  const totalDays = daysInMonth(year, month);
  const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  const dayByOutput = new Map<string, number>();
  let skipped = 0;
  let offPreferredDays = 0;
  let doubledUp = 0;
  let unspacedSiblingGroups = 0;

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

  // Per account: the even-spread "ideal" day for each output (by its rank in
  // Master Content order), the set of days still free, and which days are
  // genuine posting days. Ideals are targets, not assignments — placement
  // below picks the closest FREE day to the ideal.
  interface AccountPlan {
    idealByOutput: Map<string, number>;
    free: Set<number>;
    preferred: Set<number>;
  }
  const plans = new Map<string, AccountPlan>();
  for (const [accountId, group] of byAccount) {
    const weekdays = normalisePostingDays(input.postingDaysByAccount.get(accountId));
    const preferredDays = allDays.filter((d) => weekdays.includes(isoWeekday(year, month, d)));
    const otherDays = allDays.filter((d) => !weekdays.includes(isoWeekday(year, month, d)));
    group.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
    const n = group.length;
    // Posting days only, unless they alone can't fit the volume.
    const pool = n <= preferredDays.length ? preferredDays : [...preferredDays, ...otherDays].sort((a, b) => a - b);
    const idealByOutput = new Map<string, number>();
    const step = pool.length / n;
    group.forEach((output, i) => {
      // floor(step * (i + 0.5)) is strictly increasing for step >= 1; when
      // n exceeds the pool it cycles, and placement doubles up at the end.
      idealByOutput.set(output.id, pool[n <= pool.length ? Math.floor(step * (i + 0.5)) : i % pool.length]!);
    });
    plans.set(accountId, { idealByOutput, free: new Set(pool), preferred: new Set(preferredDays) });
  }

  /** Closest free day to the ideal (earlier day wins a tie) that keeps
   * `gap` from every day in `keepAwayFrom`. Returns whether that constraint
   * held; when nothing free satisfies it, the closest free day is used and
   * the caller records the failure. When nothing is free at all, the ideal
   * day is reused (doubled up). */
  const place = (output: SchedulableOutput, keepAwayFrom: number[]): { day: number; spaced: boolean } => {
    const plan = plans.get(output.accountId!)!;
    const ideal = plan.idealByOutput.get(output.id)!;
    // Posting days first (however far from the ideal), then the rest — a
    // non-posting day is only ever used when no posting day is free.
    const candidates = [...plan.free].sort(
      (a, b) => Number(plan.preferred.has(b)) - Number(plan.preferred.has(a)) || Math.abs(a - ideal) - Math.abs(b - ideal) || a - b
    );
    const spaced = candidates.find((d) => keepAwayFrom.every((s) => Math.abs(d - s) >= gap));
    const chosen = spaced ?? candidates[0];
    if (chosen === undefined) {
      doubledUp += 1;
      dayByOutput.set(output.id, ideal);
      return { day: ideal, spaced: keepAwayFrom.every((s) => Math.abs(ideal - s) >= gap) };
    }
    plan.free.delete(chosen);
    if (!plan.preferred.has(chosen)) offPreferredDays += 1;
    dayByOutput.set(output.id, chosen);
    return { day: chosen, spaced: spaced !== undefined };
  };

  // Pass 1 — sibling groups first (same idea + same platform family, on
  // different accounts), in Master Content order, so they get first pick of
  // the free days around their ideal slot in BOTH directions.
  const byIdeaFamily = new Map<string, SchedulableOutput[]>();
  for (const output of outputs) {
    if (!output.accountId) continue;
    const key = `${output.contentId}:${output.family}`;
    const list = byIdeaFamily.get(key) ?? [];
    list.push(output);
    byIdeaFamily.set(key, list);
  }
  const siblingGroups = [...byIdeaFamily.entries()]
    .map(([key, group]) => ({ key, group, sequence: Math.min(...group.map((o) => o.sequence)) }))
    .filter((g) => new Set(g.group.map((o) => o.accountId)).size > 1)
    .sort((a, b) => a.sequence - b.sequence || a.key.localeCompare(b.key));
  const placed = new Set<string>();
  for (const { group } of siblingGroups) {
    group.sort((a, b) => a.accountId!.localeCompare(b.accountId!) || a.id.localeCompare(b.id));
    const daysInGroup: number[] = [];
    let groupSpaced = true;
    for (const output of group) {
      if (placed.has(output.id)) continue;
      const { day, spaced } = place(output, daysInGroup);
      daysInGroup.push(day);
      placed.add(output.id);
      if (!spaced) groupSpaced = false;
    }
    if (!groupSpaced) unspacedSiblingGroups += 1;
  }

  // Pass 2 — everything else, in Master Content order, fills the gaps.
  const flexible = outputs
    .filter((o) => o.accountId && !placed.has(o.id))
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  for (const output of flexible) place(output, []);

  return { dayByOutput, skipped, offPreferredDays, doubledUp, unspacedSiblingGroups };
}
