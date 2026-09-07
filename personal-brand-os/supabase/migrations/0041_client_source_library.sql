-- Duane, after the first real generation for his own brand: the structured
-- profile alone is not rich enough to reproduce the person — the model
-- invented first-person beliefs. The consultation is where the person
-- actually lives, so it becomes a permanent source layer:
--
--   Profile              = distilled strategy (what the brand is)
--   Consultations        = source evidence (who the person is)
--   Monthly update       = what is happening now
--   Monthly Plan         = generated from all three, with provenance
--
-- V1: retain the transcript, keep an extracted Story / Belief / Voice bank
-- with a pointer back to its consultation, carry a per-month update on the
-- plan, and record on each Master Content idea which evidence supports it.

-- 1. Retain the consultation itself, not just the structured summary.
alter table public.consultations
  add column transcript text not null default '';

comment on column public.consultations.transcript is
  'Full transcript or raw notes, retained permanently as source material for content generation. Never overwritten by an import — each consultation is its own row.';

-- 2. Client Source Library — reusable client intelligence, each item tied
--    to the consultation it came from.
create table public.client_source_items (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  consultation_id  uuid references public.consultations(id) on delete set null,
  kind             text not null check (kind in ('story', 'belief', 'voice', 'avoid', 'rejected_view', 'priority', 'opportunity', 'update')),
  -- The distilled item, in PBOS's words.
  text             text not null,
  -- The client's own wording, verbatim, so generation can use their voice.
  source_quote     text not null default '',
  source_date      date,
  pillar_id        uuid references public.brand_pillars(id) on delete set null,
  sensitivity      text not null default 'public' check (sensitivity in ('public', 'sensitive')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.client_source_items is
  'Story / Belief / Voice bank extracted from consultations. kind: story (real experience usable publicly) | belief (clearly stated view or principle) | voice (exact phrase the client uses) | avoid (phrase or style to avoid) | rejected_view (something the client explicitly rejects) | priority (current priority) | opportunity (content opportunity) | update (recent personal or business update). sensitivity=sensitive is never offered to generation.';

create index client_source_items_client_idx on public.client_source_items (client_id, kind);
create index client_source_items_consultation_idx on public.client_source_items (consultation_id);

alter table public.client_source_items enable row level security;

create policy client_source_items_all on public.client_source_items for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

-- 3. The month's own short consultation / update.
alter table public.monthly_plans
  add column monthly_update text not null default '';

comment on column public.monthly_plans.monthly_update is
  'This month''s short content consultation: what has happened, changed minds, recurring questions, what is being built or struggled with, what to promote. Current source material for this month''s generation.';

-- 4. Provenance on each Master Content idea, and the platforms it is
--    intended for before any Platform Output exists (two-stage generation:
--    master ideas are approved first, outputs are generated afterwards).
alter table public.content_ideas
  add column source_evidence text not null default '',
  add column why_now text not null default '',
  add column intended_platforms uuid[] not null default '{}';

comment on column public.content_ideas.source_evidence is
  'Which profile field, source-library item or monthly-update statement supports this idea — the AI must cite it; PERSONAL_INPUT_REQUIRED when personal evidence would help but none exists.';
comment on column public.content_ideas.intended_platforms is
  'social_strategies ids this idea is intended to run on, recorded at Master Content stage; Platform Outputs are generated for them once the idea is approved.';
