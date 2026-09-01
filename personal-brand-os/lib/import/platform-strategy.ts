/**
 * Platform Strategy import (Duane's brief, 1 Sep 2026).
 *
 * Closes the loop: consultation → AI structures the strategy → import here →
 * the content importer and AI generation then read those rules. It replaces
 * copying consultation answers into fifteen-odd fields per account, for six
 * accounts.
 *
 * Two rules run through the whole module:
 *   1. It only ever UPDATES an existing account. It never creates a second
 *      LinkedIn because the name was written differently.
 *   2. A blank never wipes anything. Only fields the file actually supplies
 *      are proposed as changes.
 */

import { normaliseRecordName } from "@/lib/import/record-match";
import { PLATFORM_ROLES, CROSS_POST_RULES } from "@/lib/platform-strategy";

export interface ParsedStrategyAccount {
  /** Everything needed to find the account this belongs to. */
  accountId: string | null;
  platform: string;
  accountName: string;
  /** Column → value. Only fields the file actually supplied. */
  fields: Record<string, string | number>;
  /** Audience names to resolve against the client's real audiences. */
  primaryAudience: string | null;
  secondaryAudience: string | null;
  warnings: string[];
}

export interface ParsedStrategyImport {
  accounts: ParsedStrategyAccount[];
  warnings: string[];
}

/** JSON key → database column. Duane's field names on the left, ours on the
 * right, so the template can stay in his language. */
const FIELD_MAP: Record<string, string> = {
  tone_voice: "tone_voice",
  preferred_formats: "preferred_formats",
  typical_length: "content_length",
  commercial_balance: "commercial_ratio",
  how_to_open: "hook_guidance",
  dont_post_here: "platform_exclusions",
  repurposing_rules: "repurposing_rules",
  ai_generation_instructions: "ai_instructions",
  objective: "objective",
  audience_here: "audience",
  content_types: "content_types",
  cta: "cta_strategy",
  growth_strategy: "growth_strategy",
  engagement_strategy: "engagement_strategy",
};

/** Human labels for the preview, keyed by column. */
export const STRATEGY_FIELD_LABELS: Record<string, string> = {
  platform_role: "Role in the strategy",
  cadence_target: "Target cadence",
  cadence_period: "Cadence period",
  cross_post_rule: "Cross-posting rule",
  tone_voice: "Tone & voice",
  preferred_formats: "Preferred formats",
  content_length: "Typical length",
  commercial_ratio: "Commercial balance",
  hook_guidance: "How to open",
  platform_exclusions: "Don't post here",
  repurposing_rules: "Repurposing rules",
  ai_instructions: "AI generation instructions",
  objective: "Objective on this platform",
  audience: "Audience here",
  content_types: "Content types",
  cta_strategy: "Call to action",
  growth_strategy: "Growth strategy",
  engagement_strategy: "Engagement strategy",
  primary_audience_id: "Primary audience",
  secondary_audience_id: "Secondary audience",
};

/**
 * Role arrives as prose from a consultation ("Primary authority and
 * commercial platform"), not as our enum. Match on the words that carry the
 * meaning; if none of them appear, say so rather than guessing a role that
 * would then steer content generation.
 */
const ROLE_KEYWORDS: [string, string[]][] = [
  ["authority", ["authority", "thought leadership", "credibility"]],
  ["discovery", ["discovery", "reach", "awareness", "new audience", "top of funnel"]],
  ["community", ["community", "conversation with followers", "relationship"]],
  ["conversion", ["conversion", "lead", "enquiry", "sales", "commercial conversion"]],
  ["commentary", ["commentary", "opinion", "live comment", "reaction"]],
  ["long_form", ["long-form", "long form", "education", "deep dive", "in-depth"]],
  ["secondary", ["secondary", "supporting", "lighter", "additional distribution"]],
];

function matchRole(raw: string): { value: string | null; warning?: string } {
  const text = raw.trim().toLowerCase();
  if (!text) return { value: null };
  // An exact enum value always wins.
  const exact = PLATFORM_ROLES.find((r) => r.value && r.value === text);
  if (exact) return { value: exact.value };
  const byLabel = PLATFORM_ROLES.find((r) => r.value && r.label.toLowerCase() === text);
  if (byLabel) return { value: byLabel.value };

  // Score by how many of a role's words appear, not by which appears first:
  // "Deep authority and long-form education" is a long-form role that happens
  // to mention authority, and position alone gets that backwards.
  const scored = ROLE_KEYWORDS.map(([role, words]) => {
    const matched = words.filter((w) => text.includes(w));
    const earliest = matched.length ? Math.min(...matched.map((w) => text.indexOf(w))) : Infinity;
    return { role, hits: matched.length, earliest };
  })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.earliest - b.earliest);

  if (scored.length === 1) return { value: scored[0]!.role };
  if (scored.length > 1) {
    const winner = scored[0]!;
    // Only worth mentioning when it was a genuine toss-up.
    const contested = scored[1]!.hits === winner.hits;
    return {
      value: winner.role,
      warning: contested
        ? `Role "${raw}" describes more than one role — read as "${PLATFORM_ROLES.find((r) => r.value === winner.role)?.label}". Change it on the account if that's not right.`
        : undefined,
    };
  }
  return { value: null, warning: `Role "${raw}" didn't match a known role — left unchanged.` };
}

function matchCrossPost(raw: string): { value: string | null; warning?: string } {
  const text = raw.trim().toLowerCase();
  if (!text) return { value: null };
  const exact = CROSS_POST_RULES.find((r) => r.value === text || r.short.toLowerCase() === text);
  if (exact) return { value: exact.value };
  if (text.startsWith("do not") || text.startsWith("don't") || text.includes("never")) return { value: "never" };
  if (text.includes("selective")) return { value: "selective" };
  if (text.includes("adapt") || text.includes("rewrite")) return { value: "adapt" };
  if (text.includes("allow") || text.includes("as-is") || text.includes("as is")) return { value: "allow" };
  return { value: null, warning: `Cross-posting rule "${raw}" wasn't recognised — left unchanged.` };
}

function text(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number") return String(raw);
  return typeof raw === "string" ? raw.trim() : "";
}

function stripFences(input: string): string {
  return input.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
}

export type StrategyParseResult =
  | { ok: true; parsed: ParsedStrategyImport }
  | { ok: false; error: string };

export function parsePlatformStrategyImport(input: string): StrategyParseResult {
  let root: unknown;
  try {
    root = JSON.parse(stripFences(input));
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste exactly what the AI produced, including the curly braces." };
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { ok: false, error: "The import must be a JSON object." };
  }
  const doc = root as Record<string, unknown>;
  if (doc.pbos_import !== "social_platform_strategy") {
    return { ok: false, error: 'This isn\'t a platform strategy import — the "pbos_import" marker should read "social_platform_strategy". Use the template on this page.' };
  }
  if (doc.version !== 1) {
    return { ok: false, error: `Unsupported version "${String(doc.version)}" — this build understands version 1.` };
  }
  if (!Array.isArray(doc.accounts)) {
    return { ok: false, error: 'The import needs an "accounts" list — one entry per social account.' };
  }

  const warnings: string[] = [];
  const accounts: ParsedStrategyAccount[] = [];

  doc.accounts.forEach((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const platform = text(record.platform);
    const accountName = text(record.account_name);
    if (!platform && !accountName && !text(record.account_id)) {
      warnings.push(`Account ${i + 1} has no platform, account name or id — skipped.`);
      return;
    }

    const entry: ParsedStrategyAccount = {
      accountId: text(record.account_id) || null,
      platform,
      accountName,
      fields: {},
      primaryAudience: text(record.primary_audience) || null,
      secondaryAudience: text(record.secondary_audience) || null,
      warnings: [],
    };

    // Plain text fields — blanks are simply absent, never a wipe.
    for (const [jsonKey, column] of Object.entries(FIELD_MAP)) {
      const value = text(record[jsonKey]);
      if (value) entry.fields[column] = value;
    }

    // Role and cross-posting are decisions, so they're matched, not copied.
    const roleRaw = text(record.role_in_strategy);
    if (roleRaw) {
      const role = matchRole(roleRaw);
      if (role.value) entry.fields.platform_role = role.value;
      if (role.warning) entry.warnings.push(role.warning);
    }

    const ruleRaw = text(record.cross_posting_rule);
    if (ruleRaw) {
      const rule = matchCrossPost(ruleRaw);
      if (rule.value) entry.fields.cross_post_rule = rule.value;
      if (rule.warning) entry.warnings.push(rule.warning);
    }

    // Cadence: {value, period}, or a bare number, or "3 per week".
    const cadence = record.target_cadence;
    if (cadence !== null && cadence !== undefined && cadence !== "") {
      let value: number | null = null;
      let period: string | null = null;
      if (typeof cadence === "object" && !Array.isArray(cadence)) {
        const c = cadence as Record<string, unknown>;
        const n = Number(c.value);
        if (Number.isFinite(n)) value = n;
        const p = text(c.period).toLowerCase();
        if (p.startsWith("week")) period = "week";
        else if (p.startsWith("month")) period = "month";
      } else {
        const s = text(cadence);
        const n = Number(s.match(/\d+(\.\d+)?/)?.[0]);
        if (Number.isFinite(n)) value = n;
        if (/month/i.test(s)) period = "month";
        else if (/week/i.test(s)) period = "week";
      }
      if (value !== null && value >= 0) {
        entry.fields.cadence_target = Math.round(value);
        entry.fields.cadence_period = period ?? "week";
        if (!period) entry.warnings.push("Cadence period wasn't stated — read as per week.");
      } else {
        entry.warnings.push("Target cadence wasn't a number — left unchanged.");
      }
    }

    const known = new Set([
      "account_id", "platform", "account_name", "role_in_strategy", "target_cadence",
      "primary_audience", "secondary_audience", "cross_posting_rule", ...Object.keys(FIELD_MAP),
    ]);
    for (const key of Object.keys(record)) {
      if (!known.has(key)) entry.warnings.push(`Unrecognised field "${key}" ignored.`);
    }

    accounts.push(entry);
  });

  if (!accounts.length) return { ok: false, error: "No usable accounts in that file." };
  return { ok: true, parsed: { accounts, warnings } };
}

/**
 * Duane's matching hierarchy, in his order: account id, then account/channel
 * name, then platform. Nothing is ever created — an entry that can't be
 * placed confidently comes back for him to assign by hand.
 */
export interface MatchableAccount {
  id: string;
  platform: string;
  account_name: string;
}

export type StrategyMatch =
  | { kind: "id" | "name" | "platform"; account: MatchableAccount }
  | { kind: "ambiguous"; candidates: MatchableAccount[] }
  | { kind: "none" };

export function matchStrategyAccount(entry: ParsedStrategyAccount, accounts: MatchableAccount[]): StrategyMatch {
  if (entry.accountId) {
    const byId = accounts.find((a) => a.id === entry.accountId);
    if (byId) return { kind: "id", account: byId };
  }

  const wantName = normaliseRecordName(entry.accountName);
  const wantPlatform = normaliseRecordName(entry.platform);

  if (wantName) {
    // Name plus platform is the strongest name-based signal.
    const both = accounts.filter(
      (a) => normaliseRecordName(a.account_name) === wantName && (!wantPlatform || normaliseRecordName(a.platform) === wantPlatform)
    );
    if (both.length === 1) return { kind: "name", account: both[0]! };
    if (both.length > 1) return { kind: "ambiguous", candidates: both };

    const byName = accounts.filter((a) => normaliseRecordName(a.account_name) === wantName);
    if (byName.length === 1) return { kind: "name", account: byName[0]! };
    if (byName.length > 1) return { kind: "ambiguous", candidates: byName };
  }

  if (wantPlatform) {
    const byPlatform = accounts.filter((a) => normaliseRecordName(a.platform) === wantPlatform);
    if (byPlatform.length === 1) return { kind: "platform", account: byPlatform[0]! };
    // Several accounts on the platform and no usable name — his rule is to
    // ask rather than pick.
    if (byPlatform.length > 1) return { kind: "ambiguous", candidates: byPlatform };
  }

  return { kind: "none" };
}
