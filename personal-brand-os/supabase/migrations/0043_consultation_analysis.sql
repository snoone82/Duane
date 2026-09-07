-- Duane: Meetings & Consultations should be the input engine for PBOS, not
-- a notes area. The normal journey is
--
--   have consultation → import transcript → PBOS analyses it → review → save
--
-- rather than exporting JSON from an external AI and importing it back.
-- That structured route stays as the advanced/admin one.
--
-- The hierarchy Duane set, and the reason for these tables:
--
--   Raw consultation        = the evidence, permanent, never overwritten
--   → AI extraction         = an interpretation of it, re-runnable
--   → approved Source items = what generation may actually use
--   → approved Profile changes = strategic interpretation, human-approved
--
-- Nothing here writes to the client's profile. "A client thinking aloud in
-- a meeting should not automatically become a permanent strategy change."

-- 1. One row per analysis run. Kept after the review so a consultation can
--    be re-analysed later — by a better model — without losing what an
--    earlier pass produced or the original transcript it read.
create table public.consultation_analyses (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  consultation_id  uuid not null references public.consultations(id) on delete cascade,
  model            text not null default '',
  state            text not null default 'review' check (state in ('review', 'completed', 'discarded')),
  -- What the model said it was doing, kept for judging extraction quality.
  overview         text not null default '',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.consultation_analyses is
  'One AI pass over a consultation transcript. state: review (awaiting human approval) | completed (reviewed, approved items saved) | discarded. Re-analysing a consultation adds a new row; it never replaces the transcript.';

create index consultation_analyses_client_idx on public.consultation_analyses (client_id, created_at desc);
create index consultation_analyses_consultation_idx on public.consultation_analyses (consultation_id);

-- 2. Proposed Source Library items, awaiting approve / edit / reject.
--    Nothing reaches client_source_items until a person approves it.
create table public.consultation_source_proposals (
  id             uuid primary key default gen_random_uuid(),
  analysis_id    uuid not null references public.consultation_analyses(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  kind           text not null check (kind in ('story', 'belief', 'voice', 'avoid', 'rejected_view', 'priority', 'opportunity', 'update')),
  text           text not null,
  source_quote   text not null default '',
  sensitivity    text not null default 'public' check (sensitivity in ('public', 'sensitive')),
  state          text not null default 'pending' check (state in ('pending', 'approved', 'rejected')),
  -- The client_source_items row this became, once approved.
  source_item_id uuid references public.client_source_items(id) on delete set null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.consultation_source_proposals is
  'Extracted source material awaiting review. Approving one creates the client_source_items row; rejecting leaves the proposal as a record of what was declined, so a re-analysis does not keep re-proposing it.';

create index consultation_source_proposals_analysis_idx on public.consultation_source_proposals (analysis_id, sort_order);
create index consultation_source_proposals_client_idx on public.consultation_source_proposals (client_id, state);

-- 3. Suggested Profile Changes — reviewed separately from source material,
--    and deliberately NOT applied automatically. Approving records the
--    decision and what to change; the profile edit stays a human action.
create table public.profile_change_suggestions (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid not null references public.consultation_analyses(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  area            text not null check (area in ('vision', 'positioning', 'audiences', 'content_pillars', 'platform_strategy', 'content_guidelines', 'commercial')),
  field_label     text not null default '',
  current_value   text not null default '',
  suggested_value text not null,
  rationale       text not null default '',
  -- The client's own words that prompted it, so the reviewer can weigh the
  -- suggestion against what was actually said.
  evidence_quote  text not null default '',
  state           text not null default 'pending' check (state in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now()
);

comment on table public.profile_change_suggestions is
  'Strategy changes a consultation implies. Never applied automatically — a consultation is evidence, the profile is interpretation. Approving marks the change accepted; editing the profile itself stays a deliberate human action on the relevant tab.';

create index profile_change_suggestions_analysis_idx on public.profile_change_suggestions (analysis_id, area);
create index profile_change_suggestions_client_idx on public.profile_change_suggestions (client_id, state);

-- RLS: same rule as every other client-scoped table.
alter table public.consultation_analyses enable row level security;
alter table public.consultation_source_proposals enable row level security;
alter table public.profile_change_suggestions enable row level security;

create policy consultation_analyses_all on public.consultation_analyses for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create policy consultation_source_proposals_all on public.consultation_source_proposals for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create policy profile_change_suggestions_all on public.profile_change_suggestions for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));
