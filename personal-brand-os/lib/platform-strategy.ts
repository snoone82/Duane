/**
 * Platform Strategy Profiles (Duane's brief, 29 Aug 2026).
 *
 * The account record says WHERE a client publishes. These fields say HOW and
 * WHY that platform is used — and this module is what lets the rest of the
 * system act on them: the importer when it proposes a platform mix, the AI
 * when it writes an output, and the cadence view when it compares planned
 * against target.
 *
 * The governing principle from the brief: a master idea is not every
 * platform. Where the strategy is silent, behaviour stays neutral — an
 * account with no strategy set works exactly as it did before.
 */

export const PLATFORM_ROLES = [
  { value: "", label: "Role not set" },
  { value: "authority", label: "Authority" },
  { value: "discovery", label: "Discovery" },
  { value: "community", label: "Community" },
  { value: "conversion", label: "Conversion" },
  { value: "commentary", label: "Commentary" },
  { value: "long_form", label: "Long-form education" },
  { value: "secondary", label: "Secondary distribution" },
] as const;

export const CROSS_POST_RULES = [
  {
    value: "allow",
    label: "Allow — the same idea can run here as-is",
    short: "Allow",
    hint: "Ideas reach this account without rewriting.",
  },
  {
    value: "adapt",
    label: "Adapt — can run here, but rewrite for the platform",
    short: "Adapt",
    hint: "The default. Eligible, but never a straight copy of another platform's caption.",
  },
  {
    value: "selective",
    label: "Selective — only when it genuinely fits",
    short: "Selective",
    hint: "Proposed for review rather than added automatically.",
  },
  {
    value: "never",
    label: "Never — don't send master ideas here",
    short: "Never",
    hint: "Excluded from imports. Content for this account is created deliberately.",
  },
] as const;

export const CADENCE_PERIODS = [
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
] as const;

export type CrossPostRule = (typeof CROSS_POST_RULES)[number]["value"];

export function platformRoleLabel(value: string): string {
  return PLATFORM_ROLES.find((role) => role.value === value)?.label ?? "";
}

export function crossPostRuleMeta(value: string) {
  return CROSS_POST_RULES.find((rule) => rule.value === value) ?? CROSS_POST_RULES[1];
}

/** The strategy fields this module needs. Deliberately structural, so both
 * server actions and client components can pass whatever they've selected. */
export interface PlatformStrategy {
  id: string;
  platform: string;
  account_name: string;
  account_status: string;
  publishing_enabled: boolean;
  platform_role: string;
  cadence_target: number;
  cadence_period: string;
  cross_post_rule: string;
  tone_voice: string;
  preferred_formats: string;
  content_length: string;
  hook_guidance: string;
  commercial_ratio: string;
  platform_exclusions: string;
  repurposing_rules: string;
  ai_instructions: string;
  objective: string;
  audience: string;
  content_types: string;
  cta_strategy: string;
  posting_frequency: string;
}

// ---------------------------------------------------------------------------
// Cadence — the arithmetic the prose field could never support
// ---------------------------------------------------------------------------

/** Monthly equivalent of a target, so weekly and monthly accounts can be
 * compared on one view. 0 means no target set — never treat that as zero
 * posts wanted. */
export function monthlyTarget(strategy: Pick<PlatformStrategy, "cadence_target" | "cadence_period">): number | null {
  if (!strategy.cadence_target || strategy.cadence_target <= 0) return null;
  // 52 weeks / 12 months — the honest conversion, rounded for display.
  return strategy.cadence_period === "week" ? Math.round(strategy.cadence_target * (52 / 12)) : strategy.cadence_target;
}

export function cadenceLabel(strategy: Pick<PlatformStrategy, "cadence_target" | "cadence_period">): string {
  if (!strategy.cadence_target || strategy.cadence_target <= 0) return "No target set";
  return `${strategy.cadence_target} ${strategy.cadence_target === 1 ? "post" : "posts"} ${
    strategy.cadence_period === "week" ? "per week" : "per month"
  }`;
}

export type CadenceState = "untracked" | "under" | "on_track" | "over";

export interface CadenceStatus {
  planned: number;
  target: number | null;
  state: CadenceState;
  label: string;
}

/** Planned-vs-target for one account this month. "On track" is a band, not a
 * point: a strategy of 3 a week doesn't fail because a month has 13 posts. */
export function cadenceStatus(strategy: Pick<PlatformStrategy, "cadence_target" | "cadence_period">, planned: number): CadenceStatus {
  const target = monthlyTarget(strategy);
  if (target === null) {
    return { planned, target: null, state: "untracked", label: `${planned} planned · no target set` };
  }
  const ratio = planned / target;
  const state: CadenceState = ratio < 0.75 ? "under" : ratio > 1.25 ? "over" : "on_track";
  return { planned, target, state, label: `${planned}/${target} planned this month` };
}

// ---------------------------------------------------------------------------
// Platform mix — what the importer asks before creating an output
// ---------------------------------------------------------------------------

export type MixDecision = "include" | "review" | "exclude";

export interface MixVerdict {
  decision: MixDecision;
  /** Plain-English reason, shown in the import preview. */
  reason: string;
}

/**
 * Should a master idea produce an output on this account?
 *
 * Phase 1 deliberately filters and flags rather than scores — Duane held the
 * automatic "best platform" judgement for Phase 2, on the grounds that it's
 * easier to automate a decision once we've watched him make it by hand.
 */
export function assessPlatformFit(strategy: PlatformStrategy | null | undefined): MixVerdict {
  // No matching account on file: the importer already warns separately, and
  // an unknown platform is not something to silently drop.
  if (!strategy) return { decision: "include", reason: "No matching account on file — check this is intentional." };

  if (strategy.account_status === "inactive") {
    return { decision: "exclude", reason: "Account is inactive." };
  }
  if (!strategy.publishing_enabled) {
    return { decision: "review", reason: "Publishing is switched off for this account." };
  }

  const rule = strategy.cross_post_rule as CrossPostRule;
  if (rule === "never") {
    return { decision: "exclude", reason: "Platform strategy says master ideas don't run here." };
  }
  if (rule === "selective") {
    return { decision: "review", reason: "Selective repurposing — proposed for your call, not added automatically." };
  }
  if (strategy.account_status === "planned") {
    return { decision: "review", reason: "Account is planned rather than live." };
  }
  return {
    decision: "include",
    reason: rule === "adapt" ? "Included — copy should be rewritten for this platform." : "Included.",
  };
}

// ---------------------------------------------------------------------------
// AI generation — the platform's own instruction block
// ---------------------------------------------------------------------------

/**
 * The strategy, rendered as instructions for whichever model is writing this
 * platform's version. Only stated fields appear, so a half-filled profile
 * gives partial guidance rather than a wall of empty headings.
 */
export function buildPlatformPrompt(strategy: PlatformStrategy): string {
  const lines: string[] = [];
  const add = (label: string, value: string) => {
    if (value && value.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  const name = strategy.account_name ? `${strategy.platform} — ${strategy.account_name}` : strategy.platform;
  lines.push(`Platform: ${name}`);
  add("Role in the strategy", platformRoleLabel(strategy.platform_role));
  add("Objective", strategy.objective);
  add("Audience", strategy.audience);
  add("Tone and voice", strategy.tone_voice);
  add("Preferred formats", strategy.preferred_formats || strategy.content_types);
  add("Typical length", strategy.content_length);
  add("How to open", strategy.hook_guidance);
  add("Call to action", strategy.cta_strategy);
  add("Commercial balance", strategy.commercial_ratio);
  add("Do not post here", strategy.platform_exclusions);
  add("Repurposing rules", strategy.repurposing_rules);

  const rule = crossPostRuleMeta(strategy.cross_post_rule);
  if (strategy.cross_post_rule === "adapt" || strategy.cross_post_rule === "selective") {
    lines.push(
      `Cross-posting: ${rule.short} — this must be written for this platform in its own words, not adapted lightly from another platform's caption.`
    );
  }

  add("Additional platform guidance", strategy.ai_instructions);

  return lines.join("\n");
}

/** True when a profile has enough set to be worth citing to the AI or
 * showing as "strategy applied" in the UI. */
export function hasStrategy(strategy: PlatformStrategy): boolean {
  return Boolean(
    strategy.platform_role ||
      strategy.tone_voice.trim() ||
      strategy.preferred_formats.trim() ||
      strategy.ai_instructions.trim() ||
      strategy.cadence_target > 0 ||
      strategy.cross_post_rule !== "adapt"
  );
}
