/**
 * The ten fixed scorecard categories (brief §17). Mirrored in the
 * scorecard_entries_category_check constraint in the migration — keep both
 * in sync if this list ever changes. 0-10 scale, one entry per category per
 * scoring session.
 */
export const SCORECARD_CATEGORIES = [
  "Positioning",
  "Brand Clarity",
  "Content Consistency",
  "Audience Growth",
  "Authority",
  "Engagement",
  "Network",
  "Commercial Impact",
  "Confidence on Camera",
  "Sales Effectiveness",
] as const;

export type ScorecardCategory = (typeof SCORECARD_CATEGORIES)[number];
