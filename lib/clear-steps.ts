/**
 * The CLEAR framework's five steps — Current Reality, Life Vision, Emotional
 * Blocks, Aligned Goal, Roadmap & Review. Steps 1/2/3/5 are three open
 * reflection questions each, stored as named columns on clear_plans (see
 * supabase/migrations/0004_phase_two_clear_goals_tracker.sql). Step 4 is
 * handled separately — see components/clear/ClearGoalStepClient.tsx —
 * because it creates a `goals` row rather than saving text fields here.
 *
 * Shared between the server page (titles/letters for the step indicator)
 * and the client step component (field labels), so the two can't drift.
 */
export type ReflectionField = {
  key: "current_reality_look_like" | "current_reality_pressure" | "current_reality_pattern"
    | "life_vision_thriving" | "life_vision_feel" | "life_vision_becoming"
    | "emotional_block_belief" | "emotional_block_emotion" | "emotional_block_response"
    | "roadmap_weekly_action" | "roadmap_obstacles" | "roadmap_checkin_rhythm";
  label: string;
  placeholder?: string;
};

export type ReflectionStep = {
  step: 1 | 2 | 3 | 5;
  letter: "C" | "L" | "E" | "R";
  title: string;
  tagline: string;
  fields: ReflectionField[];
};

export const CLEAR_STEPS: ReflectionStep[] = [
  {
    step: 1,
    letter: "C",
    title: "Current Reality",
    tagline: "This isn't about judgement — it's about seeing clearly enough to choose one honest next step.",
    fields: [
      { key: "current_reality_look_like", label: "What does your current reality here actually look like?" },
      { key: "current_reality_pressure", label: "Where do you feel the most pressure, resistance or neglect?" },
      { key: "current_reality_pattern", label: "What pattern keeps repeating?" },
    ],
  },
  {
    step: 2,
    letter: "L",
    title: "Life Vision",
    tagline: "Describe what a genuinely improved, more aligned version of this area looks like for you.",
    fields: [
      { key: "life_vision_thriving", label: "What would this area look like if it was thriving?" },
      { key: "life_vision_feel", label: "How would your life feel if this area improved significantly?" },
      { key: "life_vision_becoming", label: "What kind of person would you be becoming?" },
    ],
  },
  {
    step: 3,
    letter: "E",
    title: "Emotional Blocks",
    tagline: "Most blocks are about fear, belief and habit. This step helps you name yours.",
    fields: [
      { key: "emotional_block_belief", label: "What belief or story is keeping you stuck here?" },
      { key: "emotional_block_emotion", label: "What emotion drives the avoidance or struggle?" },
      { key: "emotional_block_response", label: "What would your aligned response be when the block shows up?" },
    ],
  },
  {
    step: 5,
    letter: "R",
    title: "Roadmap & Review",
    tagline: "A plan without a review rhythm is just a wish.",
    fields: [
      { key: "roadmap_weekly_action", label: "What's the one weekly action that will move this forward?" },
      { key: "roadmap_obstacles", label: "What could get in the way?" },
      { key: "roadmap_checkin_rhythm", label: "When will you check in on your progress?" },
    ],
  },
];

export const CLEAR_STEP_TITLES: Record<number, { letter: string; title: string }> = {
  1: { letter: "C", title: "Current Reality" },
  2: { letter: "L", title: "Life Vision" },
  3: { letter: "E", title: "Emotional Blocks" },
  4: { letter: "A", title: "Aligned Goal" },
  5: { letter: "R", title: "Roadmap & Review" },
};
