-- ============================================================================
-- Realignment against the "Duane Bryan Personal Brand Database" product
-- brief (treated as authoritative per explicit instruction) — restructures
-- field sets across most tables to match its section-by-section field
-- lists, adds commercial_snapshots + audit_log, and introduces a third
-- profile role (contractor) with narrower access to strategic/internal data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- clients — §4 Client Overview: add location, a real numeric retainer figure
-- (separate from the free-text package/plan name), and the named social
-- platforms (§10 lists Instagram/YouTube/TikTok/X as channels).
-- ----------------------------------------------------------------------------
alter table public.clients
  add column location text,
  add column retainer_amount numeric,
  add column instagram_url text,
  add column youtube_url text,
  add column tiktok_url text;

comment on column public.clients.package is 'Free-text plan/package name (e.g. "Growth Package"). See retainer_amount for the dollar figure.';
comment on column public.clients.retainer_amount is 'Monthly retainer in dollars — powers the dashboard''s Revenue/Retainer Overview (brief §21).';

-- ----------------------------------------------------------------------------
-- brand_vision — §5, rebuilt to the brief's six named fields. No client data
-- exists yet, so this is a clean drop-and-recreate rather than a rename.
-- ----------------------------------------------------------------------------
alter table public.brand_vision
  drop column vision_statement,
  drop column mission_statement,
  drop column audience_goals,
  drop column authority_goals,
  drop column commercial_goals,
  drop column success_definition,
  add column long_term_goal text not null default '',
  add column desired_positioning text not null default '',
  add column authority_goal text not null default '',
  add column commercial_goal text not null default '',
  add column impact_goal text not null default '',
  add column legacy_contribution text not null default '';

comment on column public.brand_vision.long_term_goal is 'What does the client ultimately want to become known for?';
comment on column public.brand_vision.desired_positioning is 'How should people describe them when they are not in the room?';
comment on column public.brand_vision.authority_goal is 'What area do they want to become recognised as an authority in?';
comment on column public.brand_vision.commercial_goal is 'How should the personal brand contribute to income, business, career or opportunities?';
comment on column public.brand_vision.impact_goal is 'What impact do they want their voice and platform to have?';
comment on column public.brand_vision.legacy_contribution is 'What do they ultimately want to contribute to their industry or audience?';

-- ----------------------------------------------------------------------------
-- positioning — §6, rebuilt to the brief's eight named fields. Renamed
-- where a direct equivalent existed (core_expertise→expertise,
-- origin_story→unique_story, key_differentiators→differentiators);
-- category/target_audience/tone_and_voice dropped (not part of this
-- section per the brief — target_audience lives in §7 Audiences instead).
-- ----------------------------------------------------------------------------
alter table public.positioning
  drop column category,
  drop column target_audience,
  drop column tone_and_voice,
  drop column unique_value_proposition,
  add column current_positioning text not null default '';
alter table public.positioning rename column core_expertise to expertise;
alter table public.positioning rename column origin_story to unique_story;
alter table public.positioning rename column key_differentiators to differentiators;
alter table public.positioning
  add column desired_positioning text not null default '',
  add column core_beliefs text not null default '',
  add column contrarian_opinions text not null default '';

comment on column public.positioning.current_positioning is 'How is the client currently perceived?';
comment on column public.positioning.desired_positioning is 'How should the client eventually be perceived?';
comment on column public.positioning.contrarian_opinions is 'Where the client challenges conventional industry thinking — especially valuable for thought-leadership content.';

-- ----------------------------------------------------------------------------
-- audiences — §7: add the four fields the brief asks per audience beyond
-- what was already there.
-- ----------------------------------------------------------------------------
alter table public.audiences
  add column stage text not null default '',
  add column content_interests text not null default '',
  add column target_belief text not null default '',
  add column target_action text not null default '';

comment on column public.audiences.stage is 'What stage are they at?';
comment on column public.audiences.content_interests is 'What content interests them?';
comment on column public.audiences.target_belief is 'What does the client want them to think?';
comment on column public.audiences.target_action is 'What does the client want them to do?';

-- ----------------------------------------------------------------------------
-- brand_pillars — §8: the brief's eight fields per pillar (name plus the
-- seven content fields — "name" isn't an explicit brief field but is
-- obviously required as the pillar's identifier).
-- ----------------------------------------------------------------------------
alter table public.brand_pillars
  add column target_audience text not null default '',
  add column purpose text not null default '',
  add column key_messages text not null default '',
  add column example_topics text not null default '',
  add column associated_stories text not null default '',
  add column relevant_expertise text not null default '',
  add column calls_to_action text not null default '';

-- ----------------------------------------------------------------------------
-- content_ideas — §9: format/audience/priority tags, plus reach/engagement
-- so "highest-performing content" (§15 Content Metrics) has something to
-- rank once a piece is measured.
-- ----------------------------------------------------------------------------
alter table public.content_ideas
  add column format text,
  add column audience_id uuid references public.audiences(id) on delete set null,
  add column priority public.content_priority not null default 'medium',
  add column reach numeric,
  add column engagement numeric;

create index content_ideas_audience_id_idx on public.content_ideas (audience_id);

-- ----------------------------------------------------------------------------
-- consultations — §13: split the single summary field into the brief's
-- named sub-fields. `summary` stays (the brief lists it as its own field
-- alongside the rest) as a short overview; the others capture the detail.
-- ----------------------------------------------------------------------------
alter table public.consultations
  add column meeting_type text,
  add column client_updates text not null default '',
  add column wins text not null default '',
  add column challenges text not null default '',
  add column strategic_observations text not null default '',
  add column decisions_made text not null default '',
  add column content_discussed text not null default '',
  add column commercial_opportunities text not null default '';

-- ----------------------------------------------------------------------------
-- metric_snapshots — §15 Social Metrics: replace the single generic `value`
-- with the brief's ten-metric breakdown per platform. `followers` is the
-- one baseline→current→target still tracks against metric_targets.
-- ----------------------------------------------------------------------------
alter table public.metric_snapshots rename column value to followers;
alter table public.metric_snapshots
  add column follower_growth numeric,
  add column impressions numeric,
  add column reach numeric,
  add column profile_visits numeric,
  add column video_views numeric,
  add column comments numeric,
  add column shares numeric,
  add column saves numeric;
alter table public.metric_snapshots rename column engagement_rate to engagement;

comment on table public.metric_snapshots is 'Hand-entered, always — no auto-sync. Every field but followers/snapshot_date is optional; fill in what you have. The unique constraint means a second snapshot for the same client/platform/day upserts rather than erroring.';

-- ----------------------------------------------------------------------------
-- commercial_snapshots — §15 Commercial Metrics: leads/enquiries/calls/
-- customers/revenue/opportunities as periodic structured counts, distinct
-- from commercial_outcomes (which stays as the narrative log of individual
-- wins — "closed a $5k deal from a LinkedIn post" — rather than a rollup
-- number).
-- ----------------------------------------------------------------------------
create table public.commercial_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  client_id               uuid not null references public.clients(id) on delete cascade,
  period_date             date not null default current_date,
  leads_generated         numeric,
  enquiries               numeric,
  sales_calls             numeric,
  new_customers           numeric,
  revenue_attributed      numeric,
  opportunities_generated numeric,
  notes                   text not null default '',
  created_at              timestamptz not null default now(),
  unique (client_id, period_date)
);

create index commercial_snapshots_client_id_idx on public.commercial_snapshots (client_id);

comment on table public.commercial_snapshots is 'Internal only, like commercial_outcomes. Periodic structured counts (brief §15 Commercial Metrics) rather than a narrative log.';

-- ----------------------------------------------------------------------------
-- authority_opportunities — §11: audience_size, relevant to speaking
-- engagements specifically but harmless as an optional field on the rest.
-- ----------------------------------------------------------------------------
alter table public.authority_opportunities add column audience_size integer;

-- ----------------------------------------------------------------------------
-- client_files — §18: expand categories toward the brief's list. Keeps
-- `contract` (a real agency need the brief doesn't mention but shouldn't be
-- lost) and `other` as a catch-all; drops the old generic `one_pager`/
-- `content_asset` in favour of more specific brief categories.
-- ----------------------------------------------------------------------------
alter type public.file_category rename value 'one_pager' to 'presentation';
alter type public.file_category rename value 'content_asset' to 'case_study';
alter type public.file_category rename value 'brand_guide' to 'brand_guideline';
alter type public.file_category add value 'brand_photography';
alter type public.file_category add value 'video';
alter type public.file_category add value 'podcast_footage';
alter type public.file_category add value 'logo';
alter type public.file_category add value 'strategy_document';
alter type public.file_category add value 'script';
alter type public.file_category add value 'content_calendar';
alter type public.file_category add value 'press_kit';
alter type public.file_category add value 'bio';
alter type public.file_category add value 'testimonial';
