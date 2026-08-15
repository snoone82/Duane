/** The frozen content of a Strategy Sign-off Pack — captured as jsonb at
 * creation time so an approved pack never drifts as the live strategy
 * evolves. Sections follow Duane's sign-off list: North Star, Vision,
 * Positioning, Authority position, Audiences, Content pillars, Core
 * messages, Commercial objectives, Platforms/direction, Initial priorities. */

export interface SnapshotField {
  label: string;
  value: string;
}

export interface StrategySnapshot {
  clientName: string;
  northStar: string;
  vision: SnapshotField[];
  positioning: SnapshotField[];
  authorityPosition: string;
  audiences: { name: string; description: string }[];
  pillars: { name: string; description: string; keyMessages: string }[];
  coreMessages: string;
  commercialObjectives: SnapshotField[];
  platforms: { platform: string; objective: string; postingFrequency: string }[];
  priorities: { title: string; dueDate: string | null }[];
  generatedAt: string;
}

export function isStrategySnapshot(value: unknown): value is StrategySnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.clientName === "string" && Array.isArray(v.vision) && Array.isArray(v.pillars);
}

export const SIGNOFF_STATUS: { value: string; label: string; color: "slate" | "blue" | "green" | "amber" }[] = [
  { value: "draft", label: "Draft", color: "slate" },
  { value: "sent", label: "Awaiting review", color: "blue" },
  { value: "approved", label: "Approved", color: "green" },
  { value: "changes_requested", label: "Changes requested", color: "amber" },
];

export const signoffStatusMeta = (status: string) =>
  SIGNOFF_STATUS.find((s) => s.value === status) ?? SIGNOFF_STATUS[0]!;
