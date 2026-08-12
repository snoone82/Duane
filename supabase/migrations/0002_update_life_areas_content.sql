-- ============================================================================
-- Aligned — update life_areas content to Duane's final ten
-- Replaces the placeholder seed content from 0001 with the confirmed names
-- and descriptions. Updates by sort_order in place (preserves ids, and thus
-- any future FK references) rather than delete+reinsert.
-- ============================================================================

update public.life_areas set name = 'Health & Energy',
  description = 'Your physical health, energy levels, and how much vitality you have day to day.'
  where sort_order = 1;

update public.life_areas set name = 'Mindset & Thinking',
  description = 'How you think — your patterns, self-talk, and the stories you tell yourself.'
  where sort_order = 2;

update public.life_areas set name = 'Confidence & Self-Belief',
  description = 'How much you trust yourself and believe in your own capability.'
  where sort_order = 3;

update public.life_areas set name = 'Relationships & Connection',
  description = 'The closeness and quality of your relationships — partner, family, friends.'
  where sort_order = 4;

update public.life_areas set name = 'Career, Work & Business',
  description = 'Your professional life — the work you do, and where it''s heading.'
  where sort_order = 5;

update public.life_areas set name = 'Money & Stability',
  description = 'Income, savings, debt, and how secure you feel financially.'
  where sort_order = 6;

update public.life_areas set name = 'Purpose & Direction',
  description = 'Whether you feel like you know where you''re headed, and why it matters.'
  where sort_order = 7;

update public.life_areas set name = 'Daily Structure & Discipline',
  description = 'Your routines, habits, and how consistently you follow through on them.'
  where sort_order = 8;

update public.life_areas set name = 'Emotional Wellbeing',
  description = 'Your mental and emotional state — mood, stress, and resilience.'
  where sort_order = 9;

update public.life_areas set name = 'Self-Respect & Identity',
  description = 'How you see yourself, your sense of self-worth, and who you are.'
  where sort_order = 10;
