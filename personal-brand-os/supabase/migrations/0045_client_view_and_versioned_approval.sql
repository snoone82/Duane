-- Duane's final model for the monthly flow:
--
--   Stage 1 = What   AI generates the Master Content ideas
--   Stage 2 = How    AI generates the Platform Outputs
--   Client View      PBOS *shows* the month — not a third stage, not another
--                    generated artefact. A live render of the records that
--                    already exist, from the same data as the Structured
--                    Plan Export.
--   Approval         The client approves a specific version of what PBOS holds
--
-- 1. A plain-English line per idea, written at Stage 1 specifically for the
--    client-facing view, so nothing has to be composed at render time.
alter table public.content_ideas
  add column client_summary text not null default '';

comment on column public.content_ideas.client_summary is
  'One plain-English sentence describing what this piece is about, written for the client-facing view. Generated at Stage 1 so the Client View never composes anything at render time.';

-- 2. Versioned approval. Duane: approval must be tied to the version the
--    client actually signed off, not just a date — so PBOS stores a
--    fingerprint of every CLIENT-VISIBLE field at the moment of approval.
--    A later change to a client-visible field (title, hook, client summary,
--    CTA, platform, format, publish date) no longer matches, and the plan
--    shows as changed since approval. Internal production notes are not in
--    the fingerprint and so never break an approval.
alter table public.monthly_plans
  add column approved_at        timestamptz,
  add column approved_by        uuid references public.profiles(id) on delete set null,
  add column approved_note      text not null default '',
  add column approved_revision  integer,
  add column approved_fingerprint text not null default '';

comment on column public.monthly_plans.approved_fingerprint is
  'Hash of every client-visible field across the plan at the moment of approval. Recomputed on render and compared: a mismatch means a client-visible field changed after sign-off. Internal fields (source_evidence, adaptation_note, media_brief, captions, notes) are deliberately excluded — changing those must not invalidate an approval.';

comment on column public.monthly_plans.approved_revision is
  'The plan revision the client approved, so "approved" always names a specific version.';
