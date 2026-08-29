/**
 * Matching existing records on an update import (Duane's duplicate-pillar
 * report).
 *
 * The bug it fixes: pillars were matched on `name.toLowerCase()` alone, so
 * "Pillar 1 — AI Opportunity → Commercial Decision" and the same pillar
 * written as "AI Opportunity -> Commercial Decision" looked like two
 * different records and the second one was appended. Seven pillars became
 * fourteen.
 *
 * The cascade here is deliberate, most-trustworthy first:
 *   1. internal id  — exact, unambiguous, survives any rename
 *   2. exact name   — unchanged behaviour, still the common case
 *   3. normalised   — ordinal prefixes, arrows and punctuation ignored
 *
 * Step 3 never guesses: if a normalised name could be two existing records,
 * it reports `ambiguous` and the importer asks rather than picking one.
 */

export interface MatchableRecord {
  id: string;
  name: string;
}

export type MatchOutcome<T> =
  | { kind: "id"; record: T }
  | { kind: "exact"; record: T }
  | { kind: "normalised"; record: T }
  | { kind: "ambiguous"; candidates: T[] }
  | { kind: "unknown-id"; id: string }
  | { kind: "none" };

/** Leading labels an AI (or Duane) adds for readability but which aren't
 * part of the record's identity: "Pillar 1 —", "3.", "#2 -", "Audience 2:". */
const ORDINAL_PREFIX =
  /^\s*(?:#\s*)?(?:pillar|audience|platform|channel|opportunity|section|part|no\.?|number)?\s*#?\d+\s*[-–—:.)\]]+\s*/i;

/**
 * Reduce a display name to its identity. Case, ordinal prefixes, arrow
 * styles (→ / -> / => / >) and every other punctuation mark are noise:
 *
 *   "Pillar 1 — AI Opportunity → Commercial Decision"
 *   "AI Opportunity -> Commercial Decision"
 *
 * both become "ai opportunity commercial decision".
 */
export function normaliseRecordName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(ORDINAL_PREFIX, "")
    .replace(/&/g, " and ") // "Trust & Governance" === "Trust and Governance"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when two names differ only in the noise normalisation strips — i.e.
 * they almost certainly mean the same record. */
export function looksLikeSameRecord(a: string, b: string): boolean {
  const left = normaliseRecordName(a);
  return left.length > 0 && left === normaliseRecordName(b);
}

export interface RecordMatcher<T extends MatchableRecord> {
  /** Resolve one imported record against what's already on file. */
  match(input: { id?: string | null; name: string }): MatchOutcome<T>;
  /** Every existing record, for REPLACE-mode removal maths. */
  all: T[];
}

export function buildRecordMatcher<T extends MatchableRecord>(existing: T[]): RecordMatcher<T> {
  const byId = new Map(existing.map((record) => [record.id, record]));
  const byExact = new Map<string, T[]>();
  const byNormalised = new Map<string, T[]>();

  for (const record of existing) {
    const exact = record.name.trim().toLowerCase();
    byExact.set(exact, [...(byExact.get(exact) ?? []), record]);
    const normalised = normaliseRecordName(record.name);
    if (normalised) byNormalised.set(normalised, [...(byNormalised.get(normalised) ?? []), record]);
  }

  return {
    all: existing,
    match({ id, name }) {
      if (id) {
        const record = byId.get(id);
        // An id that isn't this client's is an error worth surfacing, not a
        // reason to silently create a second record.
        return record ? { kind: "id", record } : { kind: "unknown-id", id };
      }

      const exact = byExact.get(name.trim().toLowerCase());
      if (exact?.length === 1) return { kind: "exact", record: exact[0]! };
      if (exact && exact.length > 1) return { kind: "ambiguous", candidates: exact };

      const normalised = normaliseRecordName(name);
      if (!normalised) return { kind: "none" };
      const near = byNormalised.get(normalised);
      if (near?.length === 1) return { kind: "normalised", record: near[0]! };
      if (near && near.length > 1) return { kind: "ambiguous", candidates: near };

      return { kind: "none" };
    },
  };
}

/** How an update import treats a repeatable section. */
export type SectionMode = "upsert" | "replace" | "append";

export const SECTION_MODES: SectionMode[] = ["upsert", "replace", "append"];

export function isSectionMode(value: unknown): value is SectionMode {
  return typeof value === "string" && (SECTION_MODES as string[]).includes(value);
}
