import type { GoalFrequency, GoalTrackMetric, GoalType } from "@/lib/database.types";

/** Shared between the CLEAR goal step and the standalone "add a supporting goal" form, so both offer the exact same choices. */
export const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "take_action", label: "Take action" },
  { value: "build_habit", label: "Build a habit" },
  { value: "have_conversation", label: "Have a conversation" },
  { value: "set_boundary", label: "Set a boundary" },
  { value: "create_consistency", label: "Create consistency" },
];

export const GOAL_FREQUENCIES: { value: GoalFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "three_per_week", label: "3x per week" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

export const GOAL_TRACK_METRICS: { value: GoalTrackMetric; label: string }[] = [
  { value: "action_completed", label: "Action completed" },
  { value: "habit_done", label: "Habit done" },
  { value: "confidence_score", label: "Confidence score" },
  { value: "self_trust_score", label: "Self-trust score" },
  { value: "custom", label: "Custom" },
];
