-- Duane's stable-ID ask, extended to Master Content's own lead platform:
-- content_ideas.lead_platform was free text, matched fuzzily the same way
-- platform_outputs used to be — the same fragility, one level up. A real FK
-- also gives assignPlanPublishDates (lib/actions/monthly-plans.ts) something
-- concrete to distribute dates against, instead of re-matching text.
--
-- lead_platform (text) stays as the display label, kept in sync from the ID
-- at write time — nothing currently reads it as a source of truth once the
-- ID is set.
alter table public.content_ideas
  add column lead_platform_id uuid references public.social_strategies(id) on delete set null;

create index content_ideas_lead_platform_id_idx on public.content_ideas (lead_platform_id);
