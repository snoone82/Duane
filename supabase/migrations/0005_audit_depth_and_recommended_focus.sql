-- ============================================================================
-- Aligned Audit depth + Recommended Focus Area
-- Per "ALIGNED — APP & AI DEVELOPMENT BRIEF" §1 and §6.
--
-- 1. audit_responses: four new OPTIONAL reflection fields, matching the
--    brief's "for every life area we need to capture: why, what's working,
--    what's not working, what would move it forward by one point". Kept
--    optional — not required to hit Continue. Duane's own email said to
--    keep the Audit itself a snapshot rather than forcing deep reflection
--    on every area; this reconciles the two — the structured fields the
--    brief wants exist and get stored, but answering them isn't mandatory
--    to finish the Audit.
--
--    The old generic `note` column is left in place rather than dropped —
--    it's no longer written to by the app, but nothing already saved is
--    discarded.
--
-- 2. audits: recommended_focus_area_id + recommended_focus_rationale,
--    satisfying the brief's "Recommended Focus Area" audit field. Computed
--    with a rules-based heuristic at completion (reusing the same
--    importance/satisfaction weighting audit_responses.priority_score
--    already uses) — NOT a real AI call. There's no LLM integration in
--    this app yet, and choosing a provider/budget for one is a decision
--    for Steven and Duane, not something to commit to silently in a
--    migration. Swapping the placeholder heuristic for a real model call
--    later is an app-layer change, not a schema one — these two columns
--    don't need to change shape when that happens.
-- ============================================================================

alter table public.audit_responses
  add column why_this_score    text,
  add column whats_working     text,
  add column whats_not_working text,
  add column next_point_move   text;

comment on column public.audit_responses.why_this_score is 'Optional — why they gave themselves this score.';
comment on column public.audit_responses.whats_working is 'Optional — what''s currently working in this area.';
comment on column public.audit_responses.whats_not_working is 'Optional — what''s not currently working in this area.';
comment on column public.audit_responses.next_point_move is 'Optional — what would move this area forward by one point.';
comment on column public.audit_responses.note is 'Deprecated — superseded by the four columns above. Left in place (no longer written to by the app) rather than dropped, so nothing already saved is lost.';

alter table public.audits
  add column recommended_focus_area_id uuid references public.life_areas(id),
  add column recommended_focus_rationale text;

comment on column public.audits.recommended_focus_area_id is 'System-recommended focus area, computed at completion. Rules-based today (see migration header), not a real AI call. The user''s own leverage_area_id choice is what actually drives CLEAR/Goals — this is a suggestion shown alongside it, never enforced.';
comment on column public.audits.recommended_focus_rationale is 'Short, templated explanation for recommended_focus_area_id — deliberately modest in what it claims (score/importance only), since it isn''t reading the written answers yet.';
