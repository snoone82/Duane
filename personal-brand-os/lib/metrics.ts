/** Suggestions only (an HTML datalist, not an enum) — metrics are hand-entered
 * per client and platforms vary, so this stays a free-text field with hints
 * rather than a fixed list that would need a migration to extend. */
export const PLATFORM_SUGGESTIONS = [
  "LinkedIn",
  "X / Twitter",
  "Instagram",
  "YouTube",
  "Newsletter",
  "Website",
  "Podcast",
];

/** What a metric target measures (Duane): one target per platform per
 * metric. Suggestions for the form and the import template — stored as
 * snake_case free text, same philosophy as platforms. */
export const METRIC_TARGET_METRICS = [
  { value: "followers", label: "Followers" },
  { value: "impressions", label: "Impressions" },
  { value: "reach", label: "Reach" },
  { value: "engagement", label: "Engagement" },
  { value: "profile_visits", label: "Profile visits" },
  { value: "video_views", label: "Video views" },
  { value: "enquiries", label: "Enquiries" },
  { value: "leads", label: "Leads" },
] as const;

export function metricTargetLabel(metric: string): string {
  return METRIC_TARGET_METRICS.find((m) => m.value === metric)?.label ?? metric.replace(/_/g, " ");
}
